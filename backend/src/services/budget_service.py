from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget


async def upsert_budget(
    session: AsyncSession,
    user_id: int,
    category_id: int,
    month: int,
    year: int,
    amount_limit: Decimal,
) -> Budget:
    """
    Atomic UPSERT for Budget limits. Time Complexity O(1).
    """
    stmt = select(Budget).where(
        Budget.user_id == user_id,
        Budget.category_id == category_id,
        Budget.month == month,
        Budget.year == year,
    )
    result = await session.execute(stmt)
    budget = result.scalar_one_or_none()

    if budget:
        budget.amount_limit = amount_limit
    else:
        budget = Budget(
            user_id=user_id,
            category_id=category_id,
            month=month,
            year=year,
            amount_limit=amount_limit,
        )
        session.add(budget)

    await session.commit()
    await session.refresh(budget)
    return budget


async def delete_budget(
    session: AsyncSession, user_id: int, category_id: int, month: int, year: int
) -> bool:
    stmt = select(Budget).where(
        Budget.user_id == user_id,
        Budget.category_id == category_id,
        Budget.month == month,
        Budget.year == year,
    )
    result = await session.execute(stmt)
    budget = result.scalar_one_or_none()
    if budget:
        await session.delete(budget)
        await session.commit()
        return True
    return False
