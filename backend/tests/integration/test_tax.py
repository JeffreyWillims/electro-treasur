"""Integration: tax reference full-text search (Postgres FTS, no LLM)."""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import TaxRule


@pytest_asyncio.fixture
async def seeded_rules(db_session: AsyncSession) -> None:
    db_session.add_all(
        [
            TaxRule(
                category="Вычеты",
                title="Социальный вычет на лечение",
                body="Возврат 13% с расходов на лечение и назначенные лекарства.",
                source="ст. 219 НК РФ",
            ),
            TaxRule(
                category="Инвестиции",
                title="Индивидуальный инвестиционный счёт (ИИС)",
                body="Тип А даёт вычет с внесённых средств; тип Б освобождает прибыль.",
                source="ст. 219.1 НК РФ",
            ),
            TaxRule(
                category="Имущество",
                title="Продажа автомобиля",
                body="Продажа машины: при владении 3 года и более налога нет.",
                source="ст. 217 НК РФ",
            ),
        ]
    )
    await db_session.flush()


async def test_search_ranks_relevant_first(
    async_client: AsyncClient, auth_headers: dict[str, str], seeded_rules: None
) -> None:
    resp = await async_client.get(
        "/v1/tax/search", params={"q": "вычет за лечение"}, headers=auth_headers
    )
    assert resp.status_code == 200
    results = resp.json()
    assert results, "expected at least one match"
    assert "лечение" in results[0]["title"].lower()  # most relevant first


async def test_search_empty_query_browses_all(
    async_client: AsyncClient, auth_headers: dict[str, str], seeded_rules: None
) -> None:
    resp = await async_client.get("/v1/tax/search", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3  # no query → browse everything


async def test_search_or_recall_partial_terms(
    async_client: AsyncClient, auth_headers: dict[str, str], seeded_rules: None
) -> None:
    # «продал» (глагол) не роднится стеммером с «продажа», но «машину» совпадает —
    # OR-семантика всё равно находит норму про автомобиль.
    resp = await async_client.get(
        "/v1/tax/search", params={"q": "продал машину срочно"}, headers=auth_headers
    )
    assert resp.status_code == 200
    titles = [r["title"] for r in resp.json()]
    assert any("автомобил" in t.lower() for t in titles)


async def test_search_no_match_returns_empty(
    async_client: AsyncClient, auth_headers: dict[str, str], seeded_rules: None
) -> None:
    resp = await async_client.get(
        "/v1/tax/search", params={"q": "криптовалюта майнинг"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_categories_endpoint(
    async_client: AsyncClient, auth_headers: dict[str, str], seeded_rules: None
) -> None:
    resp = await async_client.get("/v1/tax/categories", headers=auth_headers)
    assert resp.status_code == 200
    assert set(resp.json()) == {"Вычеты", "Инвестиции", "Имущество"}


async def test_search_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get("/v1/tax/search", params={"q": "вычет"})
    assert resp.status_code == 401


async def test_deduction_kinds_endpoint(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.get("/v1/tax/deductions", headers=auth_headers)
    assert resp.status_code == 200
    kinds = {k["kind"] for k in resp.json()}
    assert {"treatment", "property", "mortgage", "iis"} <= kinds


async def test_calc_endpoint(async_client: AsyncClient, auth_headers: dict[str, str]) -> None:
    resp = await async_client.post(
        "/v1/tax/calc",
        json={"kind": "property", "amount": "3000000"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["refund"] == "260000.00"


async def test_calc_unknown_kind_400(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.post(
        "/v1/tax/calc", json={"kind": "nope", "amount": "1000"}, headers=auth_headers
    )
    assert resp.status_code == 400
