"""
tests/integration/conftest.py — Integration Test Guard.

Auto-skips all integration tests when PostgreSQL is not reachable,
instead of crashing with ConnectionRefusedError.
"""

from __future__ import annotations

import asyncio

import pytest


def _pg_is_reachable() -> bool:
    """Synchronous check: can we connect to the test PostgreSQL?"""
    try:
        from src.config import settings

        if not settings.database_url.endswith("_test"):
            return False

        from sqlalchemy import text
        from sqlalchemy.ext.asyncio import create_async_engine

        engine = create_async_engine(settings.database_url, pool_pre_ping=True)

        async def _ping() -> bool:
            try:
                async with engine.connect() as conn:
                    await conn.execute(text("SELECT 1"))
                return True
            except Exception:
                return False
            finally:
                await engine.dispose()

        return asyncio.run(_ping())
    except Exception:
        return False


_PG_AVAILABLE = _pg_is_reachable()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Skip integration tests if PostgreSQL is not available."""
    if _PG_AVAILABLE:
        return

    skip_marker = pytest.mark.skip(reason="PostgreSQL not reachable — integration tests skipped")
    for item in items:
        if "integration" in str(item.fspath):
            item.add_marker(skip_marker)
