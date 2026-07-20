"""
tests/integration/test_api_key_last_used.py — троттлинг last_used_at.

Регрессия на производительность: resolve_api_key обновлял last_used_at и делал
commit() на КАЖДОМ запросе публичного API, то есть чтение порождало запись по
горячей строке ключа. Теперь отметка освежается не чаще LAST_USED_THROTTLE.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import User
from src.services.api_key_service import LAST_USED_THROTTLE, create_api_key, resolve_api_key


async def test_first_use_sets_last_used_at(db_session: AsyncSession, test_user: User) -> None:
    api_key, plain = await create_api_key(db_session, test_user.id, "ключ")
    assert api_key.last_used_at is None

    resolved = await resolve_api_key(db_session, plain)

    assert resolved is not None
    assert resolved.id == test_user.id
    assert api_key.last_used_at is not None


async def test_second_use_does_not_rewrite(db_session: AsyncSession, test_user: User) -> None:
    """Повторный запрос сразу же не трогает БД — отметка остаётся прежней."""
    api_key, plain = await create_api_key(db_session, test_user.id, "ключ")
    await resolve_api_key(db_session, plain)
    first_seen = api_key.last_used_at

    await resolve_api_key(db_session, plain)

    assert api_key.last_used_at == first_seen


async def test_use_after_throttle_window_refreshes(
    db_session: AsyncSession, test_user: User
) -> None:
    """Когда окно истекло, отметка снова освежается."""
    api_key, plain = await create_api_key(db_session, test_user.id, "ключ")
    stale = datetime.now(UTC) - LAST_USED_THROTTLE - timedelta(minutes=1)
    api_key.last_used_at = stale
    await db_session.flush()

    await resolve_api_key(db_session, plain)

    assert api_key.last_used_at is not None
    assert api_key.last_used_at > stale


async def test_bad_key_resolves_to_none(db_session: AsyncSession, test_user: User) -> None:
    """Чужой/битый ключ не пускает и ничего не пишет."""
    await create_api_key(db_session, test_user.id, "ключ")
    assert await resolve_api_key(db_session, "cv_deadbeefdeadbeefdeadbeef") is None
    assert await resolve_api_key(db_session, "мусор") is None
