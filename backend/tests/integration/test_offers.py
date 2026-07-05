"""Integration tests: bank offers API + latest insight endpoint (requires PostgreSQL)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import BankOffer, Insight, User


@pytest_asyncio.fixture
async def seeded_offers(db_session: AsyncSession) -> list[BankOffer]:
    offers = [
        BankOffer(name="TestBank A", rate=Decimal("17.50"), color="#111111", sort_order=1),
        BankOffer(name="TestBank B", rate=Decimal("15.00"), color="#222222", sort_order=2),
        BankOffer(
            name="Hidden Bank", rate=Decimal("20.00"), color="#333333",
            sort_order=0, is_active=False,
        ),
    ]
    db_session.add_all(offers)
    await db_session.flush()
    return offers


async def test_list_offers_returns_active_sorted(
    async_client: AsyncClient, auth_headers: dict[str, str], seeded_offers: list[BankOffer]
) -> None:
    resp = await async_client.get("/v1/offers/", headers=auth_headers)
    assert resp.status_code == 200
    names = [o["name"] for o in resp.json()]
    assert "Hidden Bank" not in names  # inactive filtered out
    assert names.index("TestBank A") < names.index("TestBank B")  # sort_order respected


async def test_click_increments_counter(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    seeded_offers: list[BankOffer],
    db_session: AsyncSession,
) -> None:
    offer = seeded_offers[0]
    for _ in range(2):
        resp = await async_client.post(f"/v1/offers/{offer.id}/click", headers=auth_headers)
        assert resp.status_code == 204

    clicks = await db_session.scalar(
        select(BankOffer.clicks).where(BankOffer.id == offer.id)
    )
    assert clicks == 2


async def test_click_unknown_offer_404(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.post("/v1/offers/999999/click", headers=auth_headers)
    assert resp.status_code == 404


async def test_latest_insight_none_then_value(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    resp = await async_client.get("/v1/insights/latest", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() is None  # no insights yet

    db_session.add_all([
        Insight(
            user_id=test_user.id, period_start=date(2026, 5, 1), period_end=date(2026, 5, 31),
            advice="old advice", summary={"m": 5}, model_used="mock",
        ),
        Insight(
            user_id=test_user.id, period_start=date(2026, 6, 1), period_end=date(2026, 6, 30),
            advice="fresh advice", summary={"m": 6}, model_used="mock",
        ),
    ])
    await db_session.flush()

    resp = await async_client.get("/v1/insights/latest", headers=auth_headers)
    body = resp.json()
    assert body["advice"] == "fresh advice"  # newest period wins
    assert body["period_end"] == "2026-06-30"
