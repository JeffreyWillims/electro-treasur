"""Integration tests: PDF financial-plan report. Requires PostgreSQL."""

from __future__ import annotations

from datetime import date

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Insight, SavingsGoal, User

_URL = "/v1/reports/financial-plan.pdf"


async def test_report_pdf_without_data(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.get(_URL, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.content.startswith(b"%PDF")  # valid PDF even with no insight/goals


async def test_report_pdf_with_insight_and_goal(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    db_session.add_all(
        [
            Insight(
                user_id=test_user.id,
                period_start=date(2026, 6, 1),
                period_end=date(2026, 6, 30),
                advice="📊 Итог месяца: всё под контролем.\n👉 Рекомендация: копите 10%.",
                summary={
                    "total_income": "50000.00",
                    "total_expense": "30000.00",
                    "saved": "20000.00",
                },
                model_used="rule-based-v1",
            ),
            SavingsGoal(
                user_id=test_user.id,
                name="Подушка",
                target_amount="100000.00",
                current_amount="25000.00",
            ),
        ]
    )
    await db_session.flush()

    resp = await async_client.get(_URL, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF")
    assert len(resp.content) > 1000  # non-trivial document


async def test_report_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get(_URL)
    assert resp.status_code == 401
