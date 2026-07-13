"""Integration tests for the monthly insight pipeline (requires PostgreSQL)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, Insight, Transaction, User
from src.infrastructure.workers.insight_scheduler import (
    generate_period_insight,
    schedule_monthly_analysis,
)
from src.infrastructure.workers.insight_worker import calculate_static_insights
from src.services.cashflow_prep import (
    get_active_user_ids,
    get_free_funds,
    get_linked_users_without_tx_on,
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


async def test_calculate_static_insights_persists_row(
    db_session: AsyncSession, _seeded_june: User
) -> None:
    ctx = {"SessionLocal": _session_local(db_session)}
    await calculate_static_insights(ctx, _seeded_june.id, "2026-06-01", "2026-06-30")

    row = await db_session.scalar(select(Insight).where(Insight.user_id == _seeded_june.id))
    assert row is not None
    assert row.model_used == "rule-based-v1"
    assert row.period_start == date(2026, 6, 1)
    assert row.summary["total_income"] == "10000.00"
    assert row.summary["total_expense"] == "3500.00"
    # Текст собран движком: план всегда начинается с итога и кончается советом.
    assert row.advice.startswith("Итог периода")
    assert "Совет:" in row.advice


async def test_generate_period_insight_returns_real_numbers(
    db_session: AsyncSession, _seeded_june: User
) -> None:
    """Кнопка «AI Анализ»: детерминированный движок — реальные суммы, без sleep(3)."""
    ctx = {"SessionLocal": _session_local(db_session)}
    result = await generate_period_insight(ctx, _seeded_june.id, "2026-06-01", "2026-06-30")

    assert result["summary"]["total_income"] == "10000.00"
    assert result["summary"]["total_expense"] == "3500.00"
    assert result["summary"]["savings_rate"] == "65.0%"
    assert result["insight"]  # непустой готовый текст


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


# ── get_linked_users_without_tx_on ──────────────────────────────────────────
async def _make_linked_user(session: AsyncSession, email: str, chat_id: int) -> User:
    user = User(email=email, hashed_password="x", telegram_chat_id=chat_id)
    session.add(user)
    await session.flush()
    return user


async def test_get_linked_users_without_tx_on_filters(db_session: AsyncSession) -> None:
    today = date.today()

    # Привязан, без транзакций сегодня → попадает.
    inactive = await _make_linked_user(db_session, "inactive@t.dev", 111)
    # Привязан, но с транзакцией сегодня → НЕ попадает.
    active = await _make_linked_user(db_session, "active@t.dev", 222)
    await _add_transaction(db_session, active, today, "500.00", "expense")
    # Без chat_id и без транзакций → НЕ попадает.
    await _make_user(db_session, "nochat@t.dev")

    targets = await get_linked_users_without_tx_on(db_session, today)

    assert targets == [(inactive.id, 111)]


# ── get_free_funds ──────────────────────────────────────────────────────────
async def test_get_free_funds_arithmetic_and_envelopes(db_session: AsyncSession) -> None:
    start = date(2026, 6, 1)
    end = date(2026, 6, 30)
    user = await _make_user(db_session, "funds@t.dev")

    income_cat = Category(user_id=user.id, name="Зарплата", type="income")
    food_cat = Category(user_id=user.id, name="Еда", type="expense")
    db_session.add_all([income_cat, food_cat])
    await db_session.flush()

    def _tx(cat_id: int, amount: str) -> Transaction:
        return Transaction(
            user_id=user.id,
            category_id=cat_id,
            amount=Decimal(amount),
            executed_at=datetime(2026, 6, 10, 12, 0, tzinfo=UTC),
        )

    db_session.add_all(
        [_tx(income_cat.id, "10000.00"), _tx(food_cat.id, "3000.00"), _tx(food_cat.id, "500.00")]
    )
    db_session.add(
        Budget(
            user_id=user.id,
            category_id=food_cat.id,
            month=6,
            year=2026,
            amount_limit=Decimal("5000.00"),
        )
    )
    await db_session.flush()

    funds = await get_free_funds(db_session, user.id, start, end)

    assert funds["income"] == Decimal("10000.00")
    assert funds["expense"] == Decimal("3500.00")
    assert funds["free"] == Decimal("6500.00")
    assert funds["envelopes"] == [{"name": "Еда", "remaining": Decimal("1500.00")}]


async def test_get_free_funds_empty_user(db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "empty-funds@t.dev")
    funds = await get_free_funds(db_session, user.id, date(2026, 6, 1), date(2026, 6, 30))

    assert funds["income"] == Decimal("0")
    assert funds["expense"] == Decimal("0")
    assert funds["free"] == Decimal("0")
    assert funds["envelopes"] == []
