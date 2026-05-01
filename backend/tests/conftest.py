import asyncio
from unittest.mock import AsyncMock

import pytest


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db_session():
    """Mock SQLAlchemy AsyncSession."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    redis = AsyncMock()
    # default to True (lock acquired)
    redis.set.return_value = True
    return redis


@pytest.fixture
def sample_tx_rows() -> list[tuple[int, int, float]]:
    """
    Shared transaction fixture for TestDashboardAggregation.

    Format: (category_id, day_number_1indexed, amount)

    Categories:
      1 — Продукты  (plan 5 000):  fact = 1500 + 750.50 + 200 = 2450.50
      2 — Ипотека   (plan 25 000): fact = 24897.54
      3 — Транспорт (plan 6 000):  fact = 3500 + 1200 = 4700  (two rows on day 10)
    """
    return [
        # category_id, day, amount
        (1, 1, 1500.00),
        (1, 3, 750.50),
        (1, 15, 200.00),
        (2, 5, 24897.54),
        (3, 10, 3000.00),
        (3, 10, 500.00),
        (3, 20, 1200.00),
    ]
