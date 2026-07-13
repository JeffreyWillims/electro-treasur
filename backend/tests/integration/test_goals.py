"""Integration tests: Savings Goals API (режим «Цель»). Requires PostgreSQL."""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, SavingsGoal, Transaction, User


async def test_create_goal_returns_progress(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.post(
        "/v1/goals/",
        json={
            "name": "Подушка безопасности",
            "target_amount": "100000.00",
            "target_date": "2026-12-31",
            "monthly_plan": "10000.00",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Подушка безопасности"
    assert body["current_amount"] == "0.00"
    assert body["progress_pct"] == 0.0
    assert body["remaining"] == "100000.00"


async def test_list_goals_scoped_to_user(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    assert (await async_client.get("/v1/goals/", headers=auth_headers)).json() == []

    other = User(email="other-goal@citrine.dev", hashed_password="x")
    db_session.add(other)
    await db_session.flush()
    db_session.add_all(
        [
            SavingsGoal(user_id=test_user.id, name="Mine", target_amount="5000.00"),
            SavingsGoal(user_id=other.id, name="Theirs", target_amount="9000.00"),
        ]
    )
    await db_session.flush()

    names = [
        g["name"] for g in (await async_client.get("/v1/goals/", headers=auth_headers)).json()
    ]
    assert names == ["Mine"]  # ownership isolation


async def test_contribute_advances_progress_and_caps(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    goal = SavingsGoal(user_id=test_user.id, name="Ноутбук", target_amount="1000.00")
    db_session.add(goal)
    await db_session.flush()

    resp = await async_client.patch(
        f"/v1/goals/{goal.id}/contribute", json={"amount": "250.00"}, headers=auth_headers
    )
    body = resp.json()
    assert body["current_amount"] == "250.00"
    assert body["progress_pct"] == 25.0
    assert body["remaining"] == "750.00"

    # Overshoot: progress caps at 100, remaining floors at 0.
    over = await async_client.patch(
        f"/v1/goals/{goal.id}/contribute", json={"amount": "5000.00"}, headers=auth_headers
    )
    over_body = over.json()
    assert over_body["progress_pct"] == 100.0
    assert over_body["remaining"] == "0.00"


async def test_contribute_creates_expense_transaction(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Взнос в цель фиксируется расходной транзакцией в категории «Цель: {имя}»."""
    goal = SavingsGoal(user_id=test_user.id, name="Ноутбук", target_amount="1000.00")
    db_session.add(goal)
    await db_session.flush()

    resp = await async_client.patch(
        f"/v1/goals/{goal.id}/contribute", json={"amount": "250.00"}, headers=auth_headers
    )
    assert resp.status_code == 200

    category = await db_session.scalar(
        select(Category).where(Category.user_id == test_user.id, Category.name == "Цель: Ноутбук")
    )
    assert category is not None
    assert category.type == CategoryType.expense

    txs = (
        (
            await db_session.execute(
                select(Transaction).where(
                    Transaction.user_id == test_user.id,
                    Transaction.category_id == category.id,
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(txs) == 1
    assert str(txs[0].amount) == "250.00"
    assert txs[0].entry_type == "goal_contribution"


async def test_contribute_reuses_goal_category(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Повторный взнос переиспользует категорию «Цель: …» — без дублей."""
    goal = SavingsGoal(user_id=test_user.id, name="Отпуск", target_amount="9000.00")
    db_session.add(goal)
    await db_session.flush()

    for amount in ("100.00", "200.00"):
        resp = await async_client.patch(
            f"/v1/goals/{goal.id}/contribute", json={"amount": amount}, headers=auth_headers
        )
        assert resp.status_code == 200

    categories = (
        (
            await db_session.execute(
                select(Category).where(
                    Category.user_id == test_user.id, Category.name == "Цель: Отпуск"
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(categories) == 1

    amounts = sorted(
        str(t.amount)
        for t in (
            await db_session.execute(
                select(Transaction).where(Transaction.category_id == categories[0].id)
            )
        )
        .scalars()
        .all()
    )
    assert amounts == ["100.00", "200.00"]


async def test_contribute_unknown_goal_404(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.patch(
        "/v1/goals/999999/contribute", json={"amount": "10.00"}, headers=auth_headers
    )
    assert resp.status_code == 404


async def test_delete_goal(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    goal = SavingsGoal(user_id=test_user.id, name="Отпуск", target_amount="3000.00")
    db_session.add(goal)
    await db_session.flush()

    resp = await async_client.delete(f"/v1/goals/{goal.id}", headers=auth_headers)
    assert resp.status_code == 204

    remaining = await db_session.scalar(select(SavingsGoal).where(SavingsGoal.id == goal.id))
    assert remaining is None
