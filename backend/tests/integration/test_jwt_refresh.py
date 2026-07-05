"""
tests/integration/test_jwt_refresh.py — Cookie-based auth + Refresh Rotation (P1).

Аутентификация переехала на httpOnly-cookie: токены больше не в теле ответа.
Проверяется:
  • login → Set-Cookie (access+refresh), HttpOnly, тело БЕЗ токенов;
  • просроченный access-cookie → 401;
  • refresh по cookie → новая пара, СТАРЫЙ refresh мгновенно невалиден (rotation);
  • logout → cookie очищены, refresh отозван из Redis.

async_client подменяет Redis на безстейтовый AsyncMock, поэтому здесь поднимаем
stateful fake Redis (dict в памяти). Cookie задаём явным заголовком Cookie и
очищаем jar клиента между шагами, чтобы контролировать, какой токен уходит.
Секретный флаг Secure в тестах выключен (ET_COOKIE_SECURE=false), иначе httpx
не отправил бы cookie по http; HttpOnly при этом всегда включён.
"""

from __future__ import annotations

from datetime import timedelta

import pytest_asyncio
from httpx import AsyncClient

from src.domain.models import User

LOGIN_FORM = {"username": "vault-tester@citrine.dev", "password": "TestPass123!"}


class StatefulFakeRedis:
    """Мини-Redis в памяти: ровно те методы, что используют refresh-функции."""

    def __init__(self) -> None:
        self._store: dict[str, str] = {}

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        self._store[key] = value
        return True

    async def get(self, key: str) -> str | None:
        return self._store.get(key)

    async def exists(self, *keys: str) -> int:
        return sum(1 for k in keys if k in self._store)

    async def delete(self, *keys: str) -> int:
        removed = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                removed += 1
        return removed

    async def ping(self) -> bool:
        return True


@pytest_asyncio.fixture
async def client(async_client: AsyncClient) -> AsyncClient:
    """async_client, но с stateful fake Redis вместо безстейтового AsyncMock."""
    from src.dependencies import get_redis_client
    from src.main import app

    fake = StatefulFakeRedis()
    app.dependency_overrides[get_redis_client] = lambda: fake
    return async_client


def _cookie(name: str, value: str) -> dict[str, str]:
    return {"Cookie": f"{name}={value}"}


async def _login(client: AsyncClient) -> AsyncClient:
    resp = await client.post("/v1/auth/login", data=LOGIN_FORM)
    assert resp.status_code == 200, resp.text
    return client


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Login: токены в httpOnly-cookie, НЕ в теле
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def test_login_sets_httponly_cookies_and_empty_body(
    client: AsyncClient, test_user: User
) -> None:
    resp = await client.post("/v1/auth/login", data=LOGIN_FORM)
    assert resp.status_code == 200

    body = resp.json()
    assert "access_token" not in body
    assert "refresh_token" not in body

    set_cookie = resp.headers.get_list("set-cookie")
    access = [c for c in set_cookie if c.startswith("access_token=")]
    refresh = [c for c in set_cookie if c.startswith("refresh_token=")]
    assert access and refresh
    for c in access + refresh:
        assert "httponly" in c.lower()
        assert "samesite=lax" in c.lower()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Просроченный access-cookie → 401
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def test_expired_access_cookie_rejected(client: AsyncClient, test_user: User) -> None:
    from src.services.auth_service import create_access_token

    expired = create_access_token(
        data={"sub": test_user.email}, expires_delta=timedelta(minutes=-1)
    )
    client.cookies.clear()
    resp = await client.get("/v1/users/me", headers=_cookie("access_token", expired))
    assert resp.status_code == 401


async def test_no_cookie_rejected(client: AsyncClient, test_user: User) -> None:
    client.cookies.clear()
    resp = await client.get("/v1/users/me")
    assert resp.status_code == 401


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Refresh rotation по cookie: новая пара, старый refresh невалиден
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def test_refresh_rotates_and_invalidates_old(client: AsyncClient, test_user: User) -> None:
    login = await client.post("/v1/auth/login", data=LOGIN_FORM)
    old_refresh = login.cookies.get("refresh_token")
    assert old_refresh is not None
    client.cookies.clear()

    r1 = await client.post("/v1/auth/refresh", headers=_cookie("refresh_token", old_refresh))
    assert r1.status_code == 200
    new_refresh = r1.cookies.get("refresh_token")
    assert new_refresh is not None and new_refresh != old_refresh
    client.cookies.clear()

    # Rotation: старый refresh больше не работает.
    reused = await client.post("/v1/auth/refresh", headers=_cookie("refresh_token", old_refresh))
    assert reused.status_code == 401
    client.cookies.clear()

    # Новый refresh — рабочий.
    again = await client.post("/v1/auth/refresh", headers=_cookie("refresh_token", new_refresh))
    assert again.status_code == 200


async def test_refresh_without_cookie_401(client: AsyncClient, test_user: User) -> None:
    client.cookies.clear()
    resp = await client.post("/v1/auth/refresh")
    assert resp.status_code == 401


async def test_refresh_with_garbage_token_401(client: AsyncClient, test_user: User) -> None:
    client.cookies.clear()
    resp = await client.post(
        "/v1/auth/refresh", headers=_cookie("refresh_token", "not-a-real-token")
    )
    assert resp.status_code == 401


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Logout: cookie очищены, refresh отозван
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async def test_logout_clears_cookies_and_revokes_refresh(
    client: AsyncClient, test_user: User
) -> None:
    login = await client.post("/v1/auth/login", data=LOGIN_FORM)
    old_refresh = login.cookies.get("refresh_token")
    assert old_refresh is not None

    # jar содержит access+refresh — logout аутентифицируется по access-cookie.
    resp = await client.post("/v1/auth/logout")
    assert resp.status_code == 204
    # Cookie удалены (Set-Cookie с истёкшим сроком).
    set_cookie = " ".join(resp.headers.get_list("set-cookie")).lower()
    assert "access_token=" in set_cookie and "refresh_token=" in set_cookie

    # Refresh отозван в Redis — обмен больше невозможен.
    client.cookies.clear()
    after = await client.post("/v1/auth/refresh", headers=_cookie("refresh_token", old_refresh))
    assert after.status_code == 401
