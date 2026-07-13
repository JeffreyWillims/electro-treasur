"""POST /v1/agents/verify — доступ только с auth (сами проверки долгие, тут не гоняем)."""

from __future__ import annotations

from httpx import AsyncClient


async def test_agents_verify_requires_auth(async_client: AsyncClient) -> None:
    assert (await async_client.post("/v1/agents/verify")).status_code == 401
