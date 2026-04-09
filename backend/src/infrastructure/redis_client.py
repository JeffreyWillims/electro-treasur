"""
Async Redis Client Utility.

Provides a managed async Redis connection pool for the FastAPI application.
Used for:
  • Idempotency-Key caching (transaction dedup)
  • LLM insight result storage
  • arq task result polling
"""

from __future__ import annotations

from redis.asyncio import ConnectionPool, Redis

from src.config import settings

_pool: ConnectionPool | None = None


async def get_redis() -> Redis:  # type: ignore[type-arg]
    """
    Return an async Redis client backed by a shared connection pool.

    The pool is lazily created on first call and reused across the app lifetime.
    Call `close_redis()` on shutdown to release connections.
    """
    global _pool
    if _pool is None:
        _pool = ConnectionPool.from_url(settings.redis_url, decode_responses=True)
    return Redis(connection_pool=_pool)


async def close_redis() -> None:
    """Gracefully close the Redis connection pool."""
    global _pool
    if _pool is not None:
        await _pool.disconnect()
        _pool = None
