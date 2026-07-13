"""Integration: calculate_static_insights кладёт валидный psychopassport в summary.

Требует PostgreSQL (иначе авто-skip через integration/conftest.py).
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, Insight, Transaction, User
from src.infrastructure.workers.insight_worker import calculate_static_insights


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


async def _add_tx(
    session: AsyncSession, user: User, name: str, ctype: str, amount: str, day: int
) -> None:
    category = Category(user_id=user.id, name=name, type=ctype)
    session.add(category)
    await session.flush()
    session.add(
        Transaction(
            user_id=user.id,
            category_id=category.id,
            amount=Decimal(amount),
            executed_at=datetime(2026, 6, day, 12, 0, tzinfo=UTC),
        )
    )
    await session.flush()


async def test_static_insight_summary_has_valid_psychopassport(
    db_session: AsyncSession,
) -> None:
    user = User(email="pp@t.dev", hashed_password="x")
    db_session.add(user)
    await db_session.flush()

    # Доход 10000, расход 9000 (Лайфстайл 4000 → доля 0.44) → lifestyle_spender.
    await _add_tx(db_session, user, "Propulsion (Income)", "income", "10000.00", 1)
    await _add_tx(db_session, user, "Leisure (Lifestyle)", "expense", "4000.00", 10)
    await _add_tx(db_session, user, "Operations (Rent/Utility)", "expense", "5000.00", 15)

    ctx = {"SessionLocal": _session_local(db_session)}
    await calculate_static_insights(ctx, user.id, "2026-06-01", "2026-06-30")

    row = await db_session.scalar(select(Insight).where(Insight.user_id == user.id))
    assert row is not None
    pp = row.summary["psychopassport"]
    assert pp["persona_code"] == "lifestyle_spender"
    assert pp["persona_title"] == "Гедонист лайфстайла"
    assert isinstance(pp["traits"], list) and pp["traits"]
    assert isinstance(pp["recommendations"], list) and pp["recommendations"]
    # Существующие ключи summary не сломаны.
    assert row.summary["total_income"] == "10000.00"
    assert row.summary["total_expense"] == "9000.00"
