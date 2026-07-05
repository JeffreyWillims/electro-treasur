"""Integration tests for /v2/public — API-key auth and rate limiting."""

from __future__ import annotations

from collections.abc import Generator
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rate_limit import limiter
from src.domain.models import User


@pytest.fixture
def _enable_rate_limiter() -> Generator[None, None, None]:
    """Включает SlowAPI точечно (глобально он выключен в conftest) с чистыми счётчиками."""
    limiter.reset()
    limiter.enabled = True
    yield
    limiter.enabled = False
    limiter.reset()


async def test_public_api_rejects_invalid_key(async_client: AsyncClient) -> None:
    resp = await async_client.get(
        "/v2/public/categories",
        headers={"X-API-Key": "cv_deadbeef00000000000000000000000000000000"},
    )
    assert resp.status_code == 401


async def test_public_api_rate_limit_returns_429(
    async_client: AsyncClient,
    db_session: AsyncSession,
    _enable_rate_limiter: None,
) -> None:
    """61-й GET /v2/public/categories за минуту с одного IP должен получить 429."""
    user = User(email="ratelimit@t.dev", hashed_password="x")
    db_session.add(user)
    await db_session.flush()

    # Argon2-верификацию обходим: тест проверяет лимитер, а не хэширование.
    with patch("src.api.v2.public.resolve_api_key", new=AsyncMock(return_value=user)):
        for i in range(60):
            resp = await async_client.get(
                "/v2/public/categories", headers={"X-API-Key": "cv_stub"}
            )
            assert resp.status_code == 200, f"запрос #{i + 1} не должен упираться в лимит"

        resp = await async_client.get("/v2/public/categories", headers={"X-API-Key": "cv_stub"})

    assert resp.status_code == 429
