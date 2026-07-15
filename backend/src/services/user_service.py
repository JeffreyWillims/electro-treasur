from __future__ import annotations

from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, Transaction, User
from src.schemas.user import CategoryCreate, CategoryUpdate
from src.services.auth_service import get_password_hash


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """
    Fetches a user from the DB based on their email.
    """
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user_in: dict[str, Any]) -> User:
    """
    Creates a new user record in the DB with a hashed password.
    """
    hashed_password = await get_password_hash(user_in["password"])
    db_user = User(
        email=user_in["email"],
        hashed_password=hashed_password,
        full_name=user_in.get("full_name"),
        phone=user_in.get("phone"),
    )
    db.add(db_user)
    await db.flush()  # получить db_user.id

    # Создаём стартовый набор категорий
    default_categories = [
        ("Propulsion (Income)", CategoryType.income, "rocket"),
        ("Operations (Rent/Utility)", CategoryType.expense, "settings"),
        ("Leisure (Lifestyle)", CategoryType.expense, "coffee"),
        ("Growth (Investments)", CategoryType.expense, "trending-up"),
        ("Logistics (Transport)", CategoryType.expense, "car"),
        ("Wellness (Health)", CategoryType.expense, "heart"),
    ]

    for name, ctype, icon in default_categories:
        db.add(Category(user_id=db_user.id, name=name, type=ctype, icon=icon))

    await db.commit()
    await db.refresh(db_user)
    return db_user


async def update_user_profile(
    db: AsyncSession, db_user: User, update_data: dict[str, Any]
) -> User:
    """
    Updates the contact information of an existing user.
    """
    if "full_name" in update_data:
        db_user.full_name = update_data["full_name"]
    if "phone" in update_data:
        db_user.phone = update_data["phone"]
    if "monthly_income" in update_data:
        db_user.monthly_income = update_data["monthly_income"]

    await db.commit()
    await db.refresh(db_user)
    return db_user


async def create_user_category(
    db: AsyncSession, user_id: int, category_in: CategoryCreate
) -> Category:
    """
    Creates a new custom category for the user.
    """
    db_category = Category(
        user_id=user_id,
        name=category_in.name,
        type=category_in.type,
        icon=category_in.icon,
        parent_id=category_in.parent_id,
    )
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category


async def count_category_transactions(
    db: AsyncSession,
    category_id: int,
    user_id: int,
) -> int:
    """
    Предварительная проверка: COUNT транзакций, привязанных к этой категории у этого пользователя.

    Используется фронтендом перед рендером ConfirmDeleteDialog.
    Сложность: O(log N) — индексированный скан FK по (category_id, user_id).

    Возвращает:
        int — количество транзакций, которые БУДУТ удалены каскадно.
    """
    # Сначала проверяем принадлежность — предотвращает утечку данных между пользователями
    owner_stmt = select(Category.id).where(
        Category.id == category_id,
        Category.user_id == user_id,
    )
    owner_result = await db.execute(owner_stmt)
    if owner_result.scalar_one_or_none() is None:
        return -1  # Sentinel: category not found / not owned

    count_stmt = select(func.count(Transaction.id)).where(
        Transaction.category_id == category_id,
        Transaction.user_id == user_id,
    )
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def update_user_category(
    db: AsyncSession,
    category_id: int,
    user_id: int,
    payload: CategoryUpdate,
) -> Category | None:
    """
    Partially update a category's name and/or icon color.

    Ownership enforced: returns None if category_id belongs to another user.
    Time Complexity: O(log N) — PK lookup.

    Args:
        db: Async DB session.
        category_id: Target category PK.
        user_id: Authenticated user ID (ownership guard).
        payload: Partial update fields (name, icon).

    Returns:
        Updated Category ORM object, or None if not found / not owned.
    """
    stmt = select(Category).where(
        Category.id == category_id,
        Category.user_id == user_id,
    )
    result = await db.execute(stmt)
    db_category = result.scalar_one_or_none()

    if db_category is None:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_category, field, value)

    await db.commit()
    await db.refresh(db_category)
    return db_category


async def delete_user_category(
    session: AsyncSession,
    category_id: int,
    user_id: int,
) -> bool:
    """
    Explicit 3-step cascade delete — prevents IntegrityError when DB-level
    CASCADE is absent or not yet migrated.

    Execution order (respects FK dependency graph):
      Step 1 — DELETE all Transactions linked to this category.
      Step 2 — DELETE all Budget limits linked to this category.
      Step 3 — DELETE the Category itself.

    Ownership enforced: returns False if category not found or belongs to
    another user (prevents cross-user data leakage).

    ЭТО ДЕЙСТВИЕ НЕОБРАТИМО — вызывающий код (роут API) обязан убедиться,
    что пользователь явно подтвердил удаление через UI.

    Сложность: O(log N) SELECT на проверку принадлежности + O(M) массовый DELETE,
                     где M = связанные транзакции + бюджеты.

    Возвращает:
        True при успешном удалении, False если не найдено или нет прав.
    """
    # ── Шаг 0: проверка принадлежности ──────────────────────────────────────
    stmt = select(Category).where(
        Category.id == category_id,
        Category.user_id == user_id,
    )
    cat = (await session.execute(stmt)).scalar_one_or_none()
    if cat is None:
        return False

    # ── Шаг 1: удаляем все связанные транзакции ─────────────────────────────
    await session.execute(delete(Transaction).where(Transaction.category_id == category_id))

    # ── Шаг 2: удаляем все связанные лимиты бюджета ─────────────────────────
    await session.execute(delete(Budget).where(Budget.category_id == category_id))

    # ── Шаг 3: удаляем саму категорию ────────────────────────────────────────
    await session.delete(cat)
    await session.commit()

    return True
