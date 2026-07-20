"""
tests/integration/test_psychopassport_endpoint.py — GET /v1/analytics/psychopassport.

Раньше психопаспорт существовал только внутри Insight.summary, который пишет
месячный воркер: у нового пользователя он был null, и карточка в интерфейсе
просто исчезала. Эндпоинт считает его по требованию за любой период, поэтому
профиль доступен сразу и всем.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, Transaction, User

TODAY = date.today()
PERIOD = {"start": TODAY.replace(day=1).isoformat(), "end": TODAY.isoformat()}


async def _category(session: AsyncSession, user: User, name: str, ctype: CategoryType) -> Category:
    category = Category(user_id=user.id, name=name, type=ctype)
    session.add(category)
    await session.flush()
    return category


async def _tx(session: AsyncSession, user: User, category: Category, amount: str) -> None:
    session.add(
        Transaction(
            user_id=user.id,
            category_id=category.id,
            amount=amount,
            currency="RUB",
            executed_at=datetime.combine(TODAY, datetime.min.time()) + timedelta(hours=12),
        )
    )
    await session.flush()


async def test_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get("/v1/analytics/psychopassport", params=PERIOD)
    assert resp.status_code == 401


async def test_new_user_gets_passport_not_null(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    """Ключевая регрессия: даже без единой транзакции ответ — валидный профиль."""
    resp = await async_client.get(
        "/v1/analytics/psychopassport", params=PERIOD, headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["persona_code"] == "balanced"
    assert body["persona_title"]
    assert isinstance(body["traits"], list)
    assert isinstance(body["recommendations"], list)


async def test_lifestyle_spender_detected(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Больше 35% трат в Lifestyle → «Гедонист лайфстайла».

    Важно: норма сбережений должна быть ниже 30%, иначе в каскаде раньше
    сработает «Копитель» — он проверяется до гедониста.
    """
    income_cat = await _category(db_session, test_user, "Income", CategoryType.income)
    leisure = await _category(db_session, test_user, "Leisure (Lifestyle)", CategoryType.expense)
    rent = await _category(db_session, test_user, "Operations (Rent)", CategoryType.expense)
    await _tx(db_session, test_user, income_cat, "100000.00")
    await _tx(db_session, test_user, leisure, "50000.00")  # 62% расходов
    await _tx(db_session, test_user, rent, "30000.00")  # сбережения 20% < 30%

    resp = await async_client.get(
        "/v1/analytics/psychopassport", params=PERIOD, headers=auth_headers
    )

    assert resp.status_code == 200
    assert resp.json()["persona_code"] == "lifestyle_spender"


async def test_saver_detected(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Норма сбережений выше 30% и без перекосов → «Копитель»."""
    income_cat = await _category(db_session, test_user, "Income", CategoryType.income)
    rent = await _category(db_session, test_user, "Operations (Rent)", CategoryType.expense)
    await _tx(db_session, test_user, income_cat, "100000.00")
    await _tx(db_session, test_user, rent, "40000.00")

    resp = await async_client.get(
        "/v1/analytics/psychopassport", params=PERIOD, headers=auth_headers
    )

    assert resp.status_code == 200
    assert resp.json()["persona_code"] == "saver"


async def test_rejects_reversed_period(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    resp = await async_client.get(
        "/v1/analytics/psychopassport",
        params={"start": TODAY.isoformat(), "end": (TODAY - timedelta(days=5)).isoformat()},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_rejects_too_long_period(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    resp = await async_client.get(
        "/v1/analytics/psychopassport",
        params={"start": (TODAY - timedelta(days=400)).isoformat(), "end": TODAY.isoformat()},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_does_not_leak_other_users_data(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Траты чужого пользователя не влияют на профиль текущего."""
    other = User(email="other-pp@example.com", hashed_password="x")
    db_session.add(other)
    await db_session.flush()
    other_leisure = await _category(db_session, other, "Leisure (Lifestyle)", CategoryType.expense)
    await _tx(db_session, other, other_leisure, "999999.00")

    resp = await async_client.get(
        "/v1/analytics/psychopassport", params=PERIOD, headers=auth_headers
    )

    assert resp.status_code == 200
    assert resp.json()["persona_code"] == "balanced"
