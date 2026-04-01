import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

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
