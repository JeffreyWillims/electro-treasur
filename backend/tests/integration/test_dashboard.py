"""
tests/integration/test_dashboard.py — Monthly Dashboard Aggregation.

Exercises the live GET /v1/dashboard/ pipeline (route → get_monthly_dashboard →
PostgreSQL): the O(N) single-pass day matrix, budget-plan merge, delta signs
per category type, all-time balance, and the range-validation guards.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, Transaction, User


@pytest.fixture
async def dashboard_data(
    db_session: AsyncSession, test_user: User
) -> tuple[Category, Category]:
    """Seed one expense + one income category, a May-2026 budget plan and
    transactions on known days, so the matrix assertions are deterministic."""
    expense = Category(
        user_id=test_user.id, name="Groceries", type=CategoryType.expense, icon="#FF7A00"
    )
    income = Category(
        user_id=test_user.id, name="Salary", type=CategoryType.income, icon="#10B981"
    )
    db_session.add_all([expense, income])
    await db_session.flush()

    # Budget plan for expense category (May 2026).
    db_session.add(
        Budget(
            user_id=test_user.id,
            category_id=expense.id,
            month=5,
            year=2026,
            amount_limit="1000.00",
        )
    )
    # Two expense tx on the same day (day 5) → must sum in one bucket; one income tx.
    db_session.add_all(
        [
            Transaction(
                user_id=test_user.id,
                category_id=expense.id,
                amount="200.00",
                executed_at=datetime(2026, 5, 5, 12, 0, tzinfo=UTC),
            ),
            Transaction(
                user_id=test_user.id,
                category_id=expense.id,
                amount="100.00",
                executed_at=datetime(2026, 5, 5, 18, 0, tzinfo=UTC),
            ),
            Transaction(
                user_id=test_user.id,
                category_id=income.id,
                amount="5000.00",
                executed_at=datetime(2026, 5, 10, 9, 0, tzinfo=UTC),
            ),
        ]
    )
    await db_session.flush()
    return expense, income


class TestDashboardAggregation:
    async def test_matrix_totals_and_deltas(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        dashboard_data: tuple[Category, Category],
    ) -> None:
        expense, income = dashboard_data
        resp = await async_client.get(
            "/v1/dashboard/",
            params={"start_date": "2026-05-01", "end_date": "2026-05-31"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()

        # Period + all-time roll-ups: income 5000 − expense 300.
        assert body["total_balance_all_time"] == "4700.00"
        assert body["period_income"] == "5000.00"
        assert body["period_expense"] == "300.00"

        rows = {r["category_id"]: r for r in body["rows"]}
        exp_row = rows[expense.id]
        inc_row = rows[income.id]

        # Expense: two same-day tx merged into one bucket; delta = planned − fact.
        assert exp_row["planned"] == "1000.00"
        assert exp_row["fact"] == "300.00"
        assert exp_row["delta"] == "700.00"
        assert len(exp_row["days"]) == 31
        assert exp_row["days"][4] == {"day": 5, "amount": "300.00"}  # day 5 → index 4

        # Income: no plan; delta = fact − planned.
        assert inc_row["planned"] == "0.00"
        assert inc_row["fact"] == "5000.00"
        assert inc_row["delta"] == "5000.00"
        assert inc_row["days"][9] == {"day": 10, "amount": "5000.00"}

    async def test_inverted_range_rejected(
        self, async_client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        resp = await async_client.get(
            "/v1/dashboard/",
            params={"start_date": "2026-05-31", "end_date": "2026-05-01"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    async def test_range_over_90_days_rejected(
        self, async_client: AsyncClient, auth_headers: dict[str, str]
    ) -> None:
        resp = await async_client.get(
            "/v1/dashboard/",
            params={"start_date": "2026-01-01", "end_date": "2026-05-01"},
            headers=auth_headers,
        )
        assert resp.status_code == 400
