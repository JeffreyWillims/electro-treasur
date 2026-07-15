"""
Утилита асинхронного Redis-клиента.

Предоставляет управляемый асинхронный пул соединений Redis для FastAPI-приложения.
Используется для:
  • кеширования Idempotency-Key (дедупликация транзакций)
  • хранения результатов LLM-инсайтов
  • опроса результатов arq-задач
"""

from __future__ import annotations

from redis.asyncio import ConnectionPool, Redis

from src.config import settings

_pool: ConnectionPool | None = None


async def get_redis() -> Redis:
    """
    Возвращает асинхронный Redis-клиент на основе общего пула соединений.

    Пул создаётся лениво при первом вызове и переиспользуется всё время работы приложения.
    Вызовите `close_redis()` при остановке, чтобы освободить соединения.
    """
    global _pool
    if _pool is None:
        _pool = ConnectionPool.from_url(settings.redis_url, decode_responses=True)
    return Redis(connection_pool=_pool)


async def close_redis() -> None:
    """Аккуратно закрывает пул соединений Redis."""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None


# ── Хранилище refresh-токенов ──────────────────────────────────────────────────
# Refresh-токены живут ТОЛЬКО в Redis (не в JWT) — это даёт мгновенный отзыв
# (logout, rotation). Ключ на пару (user_id, token_id) — так у пользователя может
# быть несколько активных сессий, каждая отзывается независимо.
_REFRESH_TOKEN_PREFIX = "refresh_token"


def _refresh_key(user_id: int, token_id: str) -> str:
    return f"{_REFRESH_TOKEN_PREFIX}:{user_id}:{token_id}"


async def store_refresh_token(redis: Redis, user_id: int, token_id: str, ttl: int) -> None:
    """Сохраняет refresh-токен с TTL (секунды)."""
    await redis.set(_refresh_key(user_id, token_id), "1", ex=ttl)


async def is_refresh_token_valid(redis: Redis, user_id: int, token_id: str) -> bool:
    """True, если refresh-токен ещё существует (не истёк и не отозван)."""
    return bool(await redis.exists(_refresh_key(user_id, token_id)))


async def delete_refresh_token(redis: Redis, user_id: int, token_id: str) -> None:
    """Отзывает refresh-токен (rotation / logout)."""
    await redis.delete(_refresh_key(user_id, token_id))
