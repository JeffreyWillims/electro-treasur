"""
Асинхронный движок БД и фабрика сессий.

Используется исключительно драйвер asyncpg. Параметры пула соединений настроены
под PgBouncer в transaction-mode (pool_mode=transaction):
  - pool_pre_ping=True        → обнаружение протухших соединений за бачером
  - pool_recycle              → избегать долгоживущих соединений
  - statement_cache_size=0    → ОБЯЗАТЕЛЬНО под transaction-pooling: asyncpg
    иначе кэширует prepared statements, привязанные к конкретному бэкенд-
    соединению, а PgBouncer в transaction-режиме отдаёт разные соединения между
    запросами → плавающие ошибки 'prepared statement "__asyncpg_stmt__" does
    not exist'. Отключение кэша безопасно и при прямом подключении к Postgres.

Сложность: O(1) на получение сессии.
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
    pool_pre_ping=True,  # безопасный keepalive для PgBouncer
    connect_args={"statement_cache_size": 0},  # безопасно для transaction-mode PgBouncer
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Отдать асинхронную сессию, автоматически закрыв её при выходе."""
    async with async_session_factory() as session:
        yield session
