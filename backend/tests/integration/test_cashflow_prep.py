"""Integration tests for the monthly insight pipeline (requires PostgreSQL)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, Insight, Transaction, User
from src.infrastructure.workers.llm_worker import (
    generate_llm_insight,
    schedule_monthly_analysis,
)
from src.services.cashflow_prep import (
    get_active_user_ids,
    previous_month_range,
    upsert_insight,
)


class _FakeSessionCtx:
    """async-context wrapper that always yields the test's savepoint session."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def __aenter__(self) -> AsyncSession:
        return self._session

    async def __aexit__(self, *exc: object) -> bool:
        return False


def _session_local(session: AsyncSession) -> Any:
    return lambda: _FakeSessionCtx(session)


async def _make_user(session: AsyncSession, email: str) -> User:
    user = User(email=email, hashed_password="x")
    session.add(user)
    await session.flush()
    return user


async def _add_transaction(
    session: AsyncSession, user: User, when: date, amount: str, ctype: str
) -> None:
    category = Category(user_id=user.id, name=f"{ctype}-cat", type=ctype)
    session.add(category)
    await session.flush()
    session.add(
        Transaction(
            user_id=user.id,
            category_id=category.id,
            amount=Decimal(amount),
            executed_at=datetime(when.year, when.month, when.day, 12, 0, tzinfo=UTC),
        )
    )
    await session.flush()


@pytest_asyncio.fixture
async def _seeded_june(db_session: AsyncSession) -> User:
    """User with June-2026 transactions; plus noise users outside the window."""
    active = await _make_user(db_session, "active@t.dev")
    await _add_transaction(db_session, active, date(2026, 6, 10), "10000.00", "income")
    await _add_transaction(db_session, active, date(2026, 6, 20), "3500.00", "expense")

    may_user = await _make_user(db_session, "may@t.dev")
    await _add_transaction(db_session, may_user, date(2026, 5, 15), "500.00", "expense")

    await _make_user(db_session, "empty@t.dev")  # no transactions at all
    return active


async def test_get_active_user_ids_filters_by_period(
    db_session: AsyncSession, _seeded_june: User
) -> None:
    ids = await get_active_user_ids(db_session, date(2026, 6, 1), date(2026, 6, 30))
    assert ids == [_seeded_june.id]  # only the June user, not May/empty


async def test_upsert_insight_is_idempotent(db_session: AsyncSession, _seeded_june: User) -> None:
    for advice in ("first", "second"):
        await upsert_insight(
            db_session,
            user_id=_seeded_june.id,
            period_start=date(2026, 6, 1),
            period_end=date(2026, 6, 30),
            advice=advice,
            summary={"n": 1},
            model_used="mock",
        )
    await db_session.flush()

    count = await db_session.scalar(
        select(func.count()).select_from(Insight).where(Insight.user_id == _seeded_june.id)
    )
    row = await db_session.scalar(select(Insight).where(Insight.user_id == _seeded_june.id))
    assert count == 1  # second upsert overwrote, no duplicate
    assert row is not None and row.advice == "second"


async def test_generate_llm_insight_persists_row(
    db_session: AsyncSession, _seeded_june: User
) -> None:
    ctx = {"SessionLocal": _session_local(db_session)}
    await generate_llm_insight(ctx, _seeded_june.id, "2026-06-01", "2026-06-30")

    row = await db_session.scalar(select(Insight).where(Insight.user_id == _seeded_june.id))
    assert row is not None
    assert row.model_used == "mock"
    assert row.period_start == date(2026, 6, 1)
    assert "savings_rate" in row.summary


async def test_schedule_monthly_analysis_fans_out(db_session: AsyncSession) -> None:
    start, end = previous_month_range(date.today())
    u1 = await _make_user(db_session, "u1@t.dev")
    u2 = await _make_user(db_session, "u2@t.dev")
    await _add_transaction(db_session, u1, start, "100.00", "income")
    await _add_transaction(db_session, u2, end, "200.00", "expense")

    fake_pool = AsyncMock()
    ctx = {"SessionLocal": _session_local(db_session), "arq_pool": fake_pool}

    result = await schedule_monthly_analysis(ctx)

    assert result["scheduled"] == 2
    assert fake_pool.enqueue_job.await_count == 2
    # Cron с v1.1 ставит rule-based задачу, а не mock-LLM.
    fake_pool.enqueue_job.assert_any_await(
        "calculate_static_insights", u1.id, start.isoformat(), end.isoformat()
    )
