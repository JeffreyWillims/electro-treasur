from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, User
from src.schemas.user import CategoryCreate
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
    await db.flush()  # Get db_user.id

    # Seed Elite Categories
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
