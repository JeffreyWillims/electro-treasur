"""
Async Database Engine & Session Factory.

Uses asyncpg driver exclusively. Connection pooling parameters tuned for
PgBouncer in transaction-mode (pool_mode=transaction):
  - pool_pre_ping=True  → detect stale connections behind bouncer
  - pool_recycle        → avoid long-lived connections
  - NullPool OPTION     → when PgBouncer handles all pooling (toggle via env)

Complexity: O(1) per session acquisition.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
    pool_recycle=settings.db_pool_recycle,
    pool_pre_ping=True,  # PgBouncer-safe keepalive
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session, auto-close on exit."""
    async with async_session_factory() as session:
        yield session
