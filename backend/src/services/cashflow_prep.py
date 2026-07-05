"""
Cashflow analysis preparation — helpers for the monthly insight pipeline.

Pure helpers (period math) are unit-testable without a DB.
The two async helpers wrap the DB access the fan-out worker needs:
  • which users to analyse for a period,
  • how to persist the final insight idempotently.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import distinct, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Insight, Transaction


def previous_month_range(today: date) -> tuple[date, date]:
    """First and last calendar day of the month preceding `today` (both inclusive)."""
    first_of_this_month = today.replace(day=1)
    last_prev = first_of_this_month - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    return first_prev, last_prev


async def get_active_user_ids(session: AsyncSession, start: date, end: date) -> list[int]:
    """User IDs with at least one transaction in [start, end] (inclusive by date).

    Matches get_monthly_dashboard's date filter so scheduling and aggregation
    agree on what "active this month" means.
    """
    stmt = (
        select(distinct(Transaction.user_id))
        .where(
            func.date(Transaction.executed_at) >= start,
            func.date(Transaction.executed_at) <= end,
        )
        .order_by(Transaction.user_id)
    )
    result = await session.execute(stmt)
    return [row[0] for row in result.all()]


async def upsert_insight(
    session: AsyncSession,
    user_id: int,
    period_start: date,
    period_end: date,
    advice: str,
    summary: dict[str, Any],
    model_used: str,
) -> None:
    """Insert or overwrite the insight for (user, period) — idempotent re-runs."""
    stmt = insert(Insight).values(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        advice=advice,
        summary=summary,
        model_used=model_used,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_insight_user_period",
        set_={
            "advice": stmt.excluded.advice,
            "summary": stmt.excluded.summary,
            "model_used": stmt.excluded.model_used,
            "created_at": func.now(),
        },
    )
    await session.execute(stmt)
