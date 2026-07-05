"""
tests/integration/test_user_service.py — User Service Integration Tests.

Tests create_user (with 6 default categories), update_user_profile,
category CRUD, and safe-delete cascade (3-step: TX → Budget → Category).
Runs against real PostgreSQL via db_session fixture (savepoint-isolated).
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, Transaction, User
from src.schemas.user import CategoryCreate, CategoryUpdate
from src.services.user_service import (
    count_category_transactions,
    create_user,
    create_user_category,
    delete_user_category,
    get_user_by_email,
    update_user_category,
    update_user_profile,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# create_user
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCreateUser:
    """User creation with default category seeding."""

    async def test_creates_user_with_hashed_password(
        self, db_session: AsyncSession
    ) -> None:
        user = await create_user(db_session, {
            "email": "new-user@citrine.dev",
            "password": "SecurePass123!",
            "full_name": "Test User",
        })
        assert user.id is not None
        assert user.email == "new-user@citrine.dev"
        assert user.hashed_password.startswith("$argon2")
        assert user.full_name == "Test User"

    async def test_seeds_6_default_categories(
        self, db_session: AsyncSession
    ) -> None:
        """New user should get 6 default Elite categories."""
        user = await create_user(db_session, {
            "email": "seed-test@citrine.dev",
            "password": "SeedTest123!",
        })
        result = await db_session.execute(
            select(Category).where(Category.user_id == user.id)
        )
        cats = result.scalars().all()
        assert len(cats) == 6

        # Should have both income and expense categories
        types = {c.type for c in cats}
        assert CategoryType.income in types
        assert CategoryType.expense in types

    async def test_default_monthly_income_is_zero(
        self, db_session: AsyncSession
    ) -> None:
        user = await create_user(db_session, {
            "email": "zero-income@citrine.dev",
            "password": "ZeroIncome123!",
        })
        assert user.monthly_income == Decimal("0")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get_user_by_email
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestGetUserByEmail:
    """User lookup by email."""

    async def test_existing_user_found(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        found = await get_user_by_email(db_session, test_user.email)
        assert found is not None
        assert found.id == test_user.id

    async def test_nonexistent_email_returns_none(
        self, db_session: AsyncSession
    ) -> None:
        found = await get_user_by_email(db_session, "ghost@void.space")
        assert found is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# update_user_profile
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestUpdateUserProfile:
    """Partial user profile updates."""

    async def test_update_full_name(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        updated = await update_user_profile(
            db_session, test_user, {"full_name": "Евгений Обновлённый"}
        )
        assert updated.full_name == "Евгений Обновлённый"

    async def test_update_monthly_income(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        updated = await update_user_profile(
            db_session, test_user, {"monthly_income": Decimal("200000.00")}
        )
        assert updated.monthly_income == Decimal("200000.00")

    async def test_update_phone(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        updated = await update_user_profile(
            db_session, test_user, {"phone": "+79991234567"}
        )
        assert updated.phone == "+79991234567"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Category CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCategoryCrud:
    """Category create, update, count_transactions, delete."""

    async def test_create_custom_category(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        cat = await create_user_category(
            db_session,
            test_user.id,
            CategoryCreate(name="Хобби", type="expense", icon="#9333EA"),
        )
        assert cat.id is not None
        assert cat.name == "Хобби"
        assert cat.icon == "#9333EA"

    async def test_update_category_name(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        cat = await create_user_category(
            db_session,
            test_user.id,
            CategoryCreate(name="Старое имя", type="expense"),
        )
        updated = await update_user_category(
            db_session,
            cat.id,
            test_user.id,
            CategoryUpdate(name="Новое имя"),
        )
        assert updated is not None
        assert updated.name == "Новое имя"

    async def test_update_category_wrong_user_returns_none(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        cat = await create_user_category(
            db_session,
            test_user.id,
            CategoryCreate(name="Секретная", type="expense"),
        )
        result = await update_user_category(
            db_session,
            cat.id,
            user_id=999999,  # wrong user
            payload=CategoryUpdate(name="Hacked"),
        )
        assert result is None

    async def test_count_transactions_zero(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        cat = await create_user_category(
            db_session,
            test_user.id,
            CategoryCreate(name="Пустая", type="expense"),
        )
        count = await count_category_transactions(db_session, cat.id, test_user.id)
        assert count == 0

    async def test_count_transactions_not_owned_returns_sentinel(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        cat = await create_user_category(
            db_session,
            test_user.id,
            CategoryCreate(name="Чужая", type="expense"),
        )
        count = await count_category_transactions(db_session, cat.id, user_id=999999)
        assert count == -1  # sentinel: not owned

    async def test_delete_category_cascades(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        """delete_user_category should remove TX, Budget, and Category."""
        from datetime import UTC, datetime

        cat = await create_user_category(
            db_session,
            test_user.id,
            CategoryCreate(name="К удалению", type="expense"),
        )
        # Add a transaction
        tx = Transaction(
            user_id=test_user.id,
            category_id=cat.id,
            amount=Decimal("500"),
            entry_type="manual",
            executed_at=datetime.now(UTC),
        )
        db_session.add(tx)
        # Add a budget
        budget = Budget(
            user_id=test_user.id,
            category_id=cat.id,
            month=7,
            year=2026,
            amount_limit=Decimal("10000"),
        )
        db_session.add(budget)
        await db_session.flush()

        # Delete
        deleted = await delete_user_category(db_session, cat.id, test_user.id)
        assert deleted is True

        # Verify everything is gone
        tx_count = await db_session.execute(
            select(func.count(Transaction.id)).where(Transaction.category_id == cat.id)
        )
        assert tx_count.scalar() == 0

        bud_count = await db_session.execute(
            select(func.count(Budget.id)).where(Budget.category_id == cat.id)
        )
        assert bud_count.scalar() == 0

    async def test_delete_nonexistent_returns_false(
        self, db_session: AsyncSession, test_user: User
    ) -> None:
        result = await delete_user_category(db_session, 999999, test_user.id)
        assert result is False
