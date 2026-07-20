"""
API Key Service — ключи для публичного /api/v2/public.

Формат ключа: `cv_{prefix:8 hex}{secret:32 hex}`.
  • prefix — открытая часть, хранится плейнтекстом с UNIQUE-индексом:
    поиск ключа за O(1) без перебора Argon2-хэшей.
  • Полный ключ хэшируется Argon2 (та же схема, что пароли) и показывается
    пользователю ровно один раз при создании.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import ApiKey, User
from src.services.auth_service import get_password_hash, verify_password

KEY_NAMESPACE = "cv_"
PREFIX_HEX_LEN = 8
SECRET_HEX_LEN = 32


def generate_plain_key() -> tuple[str, str]:
    """Возвращает (полный ключ, prefix). Секрет — 16 байт CSPRNG."""
    prefix = secrets.token_hex(PREFIX_HEX_LEN // 2)
    secret = secrets.token_hex(SECRET_HEX_LEN // 2)
    return f"{KEY_NAMESPACE}{prefix}{secret}", prefix


def extract_prefix(plain_key: str) -> str | None:
    """Достаёт prefix из ключа; None, если формат заведомо неверный."""
    if not plain_key.startswith(KEY_NAMESPACE):
        return None
    body = plain_key[len(KEY_NAMESPACE) :]
    if len(body) != PREFIX_HEX_LEN + SECRET_HEX_LEN:
        return None
    return body[:PREFIX_HEX_LEN]


async def create_api_key(session: AsyncSession, user_id: int, name: str) -> tuple[ApiKey, str]:
    """Создаёт ключ; возвращает (ORM-объект, полный ключ — показать один раз)."""
    plain_key, prefix = generate_plain_key()
    api_key = ApiKey(
        user_id=user_id,
        name=name,
        prefix=prefix,
        key_hash=await get_password_hash(plain_key),
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)
    return api_key, plain_key


# Как часто освежать last_used_at. Точность «до пяти минут» здесь достаточна,
# а запись на КАЖДЫЙ запрос превращала чтение публичного API в UPDATE+COMMIT
# по горячей строке ключа.
LAST_USED_THROTTLE = timedelta(minutes=5)


async def resolve_api_key(session: AsyncSession, plain_key: str) -> User | None:
    """
    Аутентификация по ключу: prefix-lookup → Argon2-верификация → владелец.

    Освежает last_used_at не чаще раза в LAST_USED_THROTTLE. None — ключ
    неверен/отозван.
    """
    prefix = extract_prefix(plain_key)
    if prefix is None:
        return None

    stmt = select(ApiKey).where(ApiKey.prefix == prefix, ApiKey.is_active.is_(True))
    api_key = (await session.execute(stmt)).scalar_one_or_none()
    if api_key is None:
        return None

    if not await verify_password(plain_key, api_key.key_hash):
        return None

    user = await session.get(User, api_key.user_id)

    now = datetime.now(UTC)
    last_used = api_key.last_used_at
    if last_used is None or now - last_used >= LAST_USED_THROTTLE:
        api_key.last_used_at = now
        await session.commit()
    return user
