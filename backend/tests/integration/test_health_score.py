"""Integration tests: Financial Health Score API. Requires PostgreSQL."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, SavingsGoal, Transaction, User


async def test_health_score_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get("/v1/health-score/")
    assert resp.status_code == 401


async def test_health_score_returns_valid_index(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    now = datetime.now(UTC)

    income_cat = Category(user_id=test_user.id, name="Зарплата", type=CategoryType.income)
    expense_cat = Category(user_id=test_user.id, name="Еда", type=CategoryType.expense)
    db_session.add_all([income_cat, expense_cat])
    await db_session.flush()

    db_session.add_all(
        [
            Transaction(
                user_id=test_user.id,
                category_id=income_cat.id,
                amount=Decimal("100000.00"),
                executed_at=now,
            ),
            Transaction(
                user_id=test_user.id,
                category_id=expense_cat.id,
                amount=Decimal("40000.00"),
                executed_at=now,
            ),
        ]
    )
    # A goal (progress 50%) and a budget the user is within.
    db_session.add(
        SavingsGoal(
            user_id=test_user.id,
            name="Отпуск",
            target_amount=Decimal("10000.00"),
            current_amount=Decimal("5000.00"),
        )
    )
    db_session.add(
        Budget(
            user_id=test_user.id,
            category_id=expense_cat.id,
            month=now.month,
            year=now.year,
            amount_limit=Decimal("50000.00"),
        )
    )
    await db_session.flush()

    resp = await async_client.get("/v1/health-score/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()

    assert 0 <= body["score"] <= 100
    assert body["grade"] in {"Отличное", "Хорошее", "Среднее", "Требует внимания"}
    assert len(body["factors"]) == 3
    assert [f["name"] for f in body["factors"]] == ["Норма сбережений", "Цели", "Бюджеты"]
    for factor in body["factors"]:
        assert 0 <= factor["score"] <= 100


async def test_health_score_neutral_when_no_data(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    # Fresh user: no transactions, no goals, no budgets → savings 0, goals/budgets neutral 60.
    resp = await async_client.get("/v1/health-score/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 30  # round(0*0.5 + 60*0.25 + 60*0.25)
    assert body["grade"] == "Требует внимания"
