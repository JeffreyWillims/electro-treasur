"""
tests/conftest.py — Citrine Vault Test Infrastructure Core.

Architecture: Transaction Rollback Isolation Pattern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM: Tests that commit to the DB pollute each other.
         CREATE/DROP ALL per test is O(N × schema_size) — unacceptable.

SOLUTION: Nested Savepoint Strategy (2-tier transaction isolation):

  ┌──────────────────────────────────────────────┐
  │  CONNECTION TRANSACTION (never committed)     │ ← db_connection fixture
  │  ┌──────────────────────────────────────────┐ │
  │  │  SAVEPOINT (rolled back after each test) │ │ ← db_session fixture
  │  │  ┌────────────────────────────────────┐  │ │
  │  │  │ test_create_user()                 │  │ │
  │  │  │ session.add(User(...))             │  │ │
  │  │  │ await session.flush()  ← visible   │  │ │
  │  │  └────────────────────────────────────┘  │ │
  │  │  ROLLBACK TO SAVEPOINT ← erases all      │ │
  │  └──────────────────────────────────────────┘ │
  │  ROLLBACK ← connection returns clean          │
  └──────────────────────────────────────────────┘

Guarantees:
  • Zero inter-test contamination (Hermetic Tests)
  • O(1) cleanup per test (ROLLBACK vs DROP ALL)
  • Real PostgreSQL dialect (no SQLite fakes)
  • FastAPI dependency injection correctly overridden

Environment:
  • pytest-env injects ET_DATABASE_URL pointing to `_test` DB
  • ET_SECRET_KEY set to a stable test value
  • See [tool.pytest_env] in pyproject.toml
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import settings
from src.domain.models import Base, User

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. SAFETY GUARD — abort if someone accidentally points at production DB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
assert settings.database_url.endswith("_test"), (
    f"🔴 ABORT: DATABASE_URL does not end with '_test'!\n"
    f"   Got: {settings.database_url}\n"
    f"   Refusing to run tests against a non-test database.\n"
    f"   Check [tool.pytest_env] in pyproject.toml."
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. TEST ENGINE — isolated from production engine in src/database.py
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test_engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    # Minimal pool for tests — we never need parallelism here
    pool_size=5,
    max_overflow=0,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. SCHEMA LIFECYCLE — create tables once per session, drop after
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture(scope="session")
async def _create_tables() -> AsyncGenerator[None, None]:
    """
    Session-scoped: CREATE ALL before first test, DROP ALL after last test.

    This runs once per `pytest` invocation. Individual tests use savepoints
    (see db_session) so they never see each other's data.
    """
    # Force-import all models so Base.metadata knows about them

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. CONNECTION + SAVEPOINT — the core isolation mechanism
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture
async def db_connection(
    _create_tables: None,
) -> AsyncGenerator[AsyncConnection, None]:
    """
    Per-test raw connection with an uncommitted transaction.

    The outer transaction is NEVER committed — after the test completes,
    we ROLLBACK, restoring the DB to the pre-test state in O(1).
    """
    async with test_engine.connect() as conn:
        transaction = await conn.begin()
        try:
            yield conn
        finally:
            await transaction.rollback()


@pytest_asyncio.fixture
async def db_session(
    db_connection: AsyncConnection,
) -> AsyncGenerator[AsyncSession, None]:
    """
    Per-test AsyncSession bound to a SAVEPOINT inside the connection transaction.

    Key mechanics:
      • Session.begin_nested() creates a PostgreSQL SAVEPOINT.
      • All ORM operations (add/flush/query) happen inside this savepoint.
      • If the application code calls session.commit(), SQLAlchemy commits
        the SAVEPOINT (not the outer transaction) — data is visible within
        the same connection but not to other tests.
      • After yield, we rollback the savepoint explicitly.
      • The outer connection transaction (db_connection) also rolls back,
        providing a second safety net.

    Why not just session.rollback()?
      Because application code may call session.commit() internally
      (e.g., inside a service function). The savepoint absorbs the commit
      without leaking data to the connection-level transaction.
    """
    # Bind a session factory to this specific connection
    testing_session_factory = async_sessionmaker(
        bind=db_connection,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with testing_session_factory() as session:
        # Start a nested savepoint
        nested = await session.begin_nested()
        try:
            yield session
        finally:
            # Rollback the savepoint — even if tests called session.commit()
            if nested.is_active:
                await nested.rollback()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. FASTAPI TEST CLIENT — with dependency override
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture
async def async_client(
    db_session: AsyncSession,
) -> AsyncGenerator[AsyncClient, None]:
    """
    httpx.AsyncClient wired to the FastAPI app with DB dependency overridden.

    The app's `get_db()` / `get_session()` dependencies are replaced so that
    all route handlers receive the SAME db_session that the test controls.
    This means route-level commits are absorbed by the savepoint.

    Redis is replaced with a FakeRedis-like AsyncMock to avoid requiring
    a running Redis instance for integration tests.
    """
    from unittest.mock import AsyncMock

    from src.database import get_session
    from src.dependencies import get_db, get_redis_client
    from src.main import app

    # Override both DB dependency variants
    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    # Fake Redis — returns None for GET, OK for SET/PING
    fake_redis = AsyncMock()
    fake_redis.get.return_value = None
    fake_redis.set.return_value = True
    fake_redis.ping.return_value = True

    app.dependency_overrides[get_db] = _override_session
    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_redis_client] = lambda: fake_redis

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        yield client

    # Clean up overrides so they don't leak between test modules
    app.dependency_overrides.clear()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. AUTH HELPERS — convenience fixtures for authenticated requests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """
    Create a canonical test user in the DB.

    Returns the ORM User instance with a known password ('TestPass123!').
    Uses argon2-cffi PasswordHasher — same as production auth_service.py.
    """
    from argon2 import PasswordHasher

    from src.domain.models import User

    ph = PasswordHasher()
    user = User(
        email="vault-tester@citrine.dev",
        hashed_password=ph.hash("TestPass123!"),
        full_name="Citrine Tester",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def auth_headers(test_user: User) -> dict[str, str]:
    """
    Return Authorization headers with a valid JWT for `test_user`.
    """
    from src.services.auth_service import create_access_token

    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}
