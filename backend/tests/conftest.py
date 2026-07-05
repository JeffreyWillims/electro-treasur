"""
tests/conftest.py — Основная тестовая инфраструктура Citrine Vault.

Тесты, которые работают с базой данных, не должны влиять друг на друга.
Вместо медленного удаления/создания таблиц перед каждым тестом, мы
оставляем одно соединение с открытой транзакцией на всю тестовую сессию, а
каждый отдельный тест выполняем внутри собственного SAVEPOINT (Точки сохранения).

Внутри теста можно свободно создавать и удалять данные, а также
вызывать commit(). После завершения теста выполняется откат к SAVEPOINT,
и база данных мгновенно возвращается в исходное состояние.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.config import settings
from src.domain.models import Base, User

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SAFETY GUARD — защита продакшен-базы от случайного удаления
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
assert settings.database_url.endswith("_test"), (
    f"🔴 ОСТАНОВКА: DATABASE_URL не заканчивается на '_test'!\n"
    f"   Текущий URL: {settings.database_url}\n"
    f"   Запуск тестов на не-тестовой базе данных запрещен.\n"
    f"   Проверьте секцию [tool.pytest_env] в pyproject.toml."
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ТЕСТОВЫЙ ДВИЖОК БД — изолирован от основного движка приложения
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test_engine = create_async_engine(
    settings.database_url,
    echo=False,
    # NullPool: каждое обращение к БД создает новое соединение в текущем event loop.
    # Это спасает от ошибки "Future attached to a different loop" в pytest-asyncio.
    poolclass=NullPool,
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ЖИЗНЕННЫЙ ЦИКЛ СХЕМЫ — создаем таблицы 1 раз за сессию
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture(scope="session")
async def _create_tables() -> AsyncGenerator[None, None]:
    """
    Выполняется ОДИН РАЗ за весь запуск pytest.
    Создает все таблицы (CREATE ALL) перед первым тестом и удаляет (DROP ALL) после последнего.
    """
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RATE LIMITER — отключаем в тестах
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SlowAPI-лимитер держит счётчики в памяти по IP; все тесты ходят с одного
# testserver-адреса, поэтому состояние копится за весь прогон и ложно роняет
# тесты, делающие несколько login/refresh. 429-поведение здесь не проверяется.
@pytest.fixture(autouse=True)
def _disable_rate_limiter() -> None:
    from src.core.rate_limit import limiter

    limiter.enabled = False

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ПОДКЛЮЧЕНИЕ + SAVEPOINT — ядро механизма изоляции
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture
async def db_connection(_create_tables: None) -> AsyncGenerator[AsyncConnection, None]:
    """Глобальная транзакция соединения для теста. Никогда не коммитится."""
    async with test_engine.connect() as conn:
        transaction = await conn.begin()
        try:
            yield conn
        finally:
            await transaction.rollback()

@pytest_asyncio.fixture
async def db_session(db_connection: AsyncConnection) -> AsyncGenerator[AsyncSession, None]:
    """
    Сессия БД для каждого теста, привязанная к SAVEPOINT (Точке сохранения).
    Если код приложения вызовет session.commit(), закоммитится только SAVEPOINT,
    данные не утекут в основную транзакцию. После теста мы откатываем всё назад.
    """
    testing_session_factory = async_sessionmaker(
        bind=db_connection, class_=AsyncSession, expire_on_commit=False,
    )
    async with testing_session_factory() as session:
        nested = await session.begin_nested() # Создаем SAVEPOINT в PostgreSQL
        try:
            yield session
        finally:
            # Откат SAVEPOINT — база снова чистая!
            if nested.is_active:
                await nested.rollback()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FASTAPI ТЕСТОВЫЙ КЛИЕНТ — с переопределением зависимостей (DI)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    HTTPX клиент. Подменяет реальную базу данных в FastAPI на нашу тестовую
    сессию с SAVEPOINT, а реальный Redis заменяет на AsyncMock-заглушку.
    """
    from unittest.mock import AsyncMock
    from src.database import get_session
    from src.dependencies import get_db, get_redis_client
    from src.main import app

    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    # Фейковый Redis — мгновенные ответы в памяти
    fake_redis = AsyncMock()
    fake_redis.get.return_value = None
    fake_redis.set.return_value = True
    fake_redis.ping.return_value = True

    # Dependency Override: FastAPI будет использовать наши заглушки
    app.dependency_overrides[get_db] = _override_session
    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_redis_client] = lambda: fake_redis

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear() # Очистка после теста

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AUTH ПОМОЩНИКИ — фикстуры для тестирования закрытых роутов
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Создает эталонного пользователя в БД для каждого теста."""
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
    Аутентификация тестового пользователя через access-token cookie.

    Auth переехал на httpOnly-cookie (Cookie-заголовок), а не Authorization: Bearer.
    Возвращаем Cookie-заголовок, чтобы существующие вызовы `headers=auth_headers`
    продолжали работать без изменений на каждом сайте вызова.
    """
    from src.services.auth_service import create_access_token
    token = create_access_token(data={"sub": test_user.email})
    return {"Cookie": f"access_token={token}"}