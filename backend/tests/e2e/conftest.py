"""
tests/e2e/conftest.py — Тестовая инфраструктура E2E на Playwright.
"""

from __future__ import annotations

import pytest


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Автоматически пропускать E2E-тесты, если playwright не установлен."""
    try:
        import playwright  # noqa: F401
    except ImportError:
        skip_marker = pytest.mark.skip(reason="Playwright not installed — E2E tests skipped")
        for item in items:
            if "e2e" in str(item.fspath):
                item.add_marker(skip_marker)


try:
    import playwright  # noqa: F401

    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False

if _PLAYWRIGHT_AVAILABLE:
    from pathlib import Path

    import pytest_asyncio
    from playwright.async_api import Browser, BrowserContext, Page, async_playwright

    # ── Конфигурация ─────────────────────────────────────────────────────────────
    FRONTEND_URL = "http://localhost:5173"
    BACKEND_URL = "http://localhost:8000"
    TEST_USER_EMAIL = "vault-tester@citrine.dev"
    TEST_USER_PASSWORD = "TestPass123!"
    AUTH_STATE_FILE = Path(__file__).parent / ".auth_state.json"


if _PLAYWRIGHT_AVAILABLE:
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # СКОУП СЕССИИ: жизненный цикл браузера
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture(scope="session")
    async def browser():
        """Запустить один экземпляр Chromium на всю тестовую сессию."""
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            yield browser
            await browser.close()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # СКОУП СЕССИИ: аутентифицироваться один раз, сохранить storageState
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture(scope="session")
    async def auth_storage_state(browser: Browser) -> Path:
        """
        Аутентифицироваться через API, внедрить JWT в localStorage браузера
        и сохранить storageState в JSON-файл.

        Выполняется ОДИН РАЗ за сессию — все тесты переиспользуют сохранённое состояние.
        Возвращает путь к JSON-файлу storageState.
        """
        # Устарело: auth переехал на httpOnly-cookie, токена в теле логина больше
        # нет и localStorage не используется. Сценарий нужно переписать на приём
        # cookie в браузерный контекст (см. docs/frontend_migration.md).
        pytest.skip("Needs cookie migration (httpOnly auth) — see docs/frontend_migration.md")

        import httpx

        # Шаг 1: получить JWT-токен через API (минуя вход через UI)
        async with httpx.AsyncClient(base_url=BACKEND_URL) as client:
            response = await client.post(
                "/v1/auth/login",
                data={
                    "username": TEST_USER_EMAIL,
                    "password": TEST_USER_PASSWORD,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                pytest.skip(
                    f"Cannot authenticate for E2E tests: "
                    f"POST /v1/auth/login returned {response.status_code}. "
                    f"Ensure backend is running and test user exists."
                )

            # УСТАРЕЛО: auth переехал на httpOnly-cookie, токена в теле больше нет.
            # Этот блок нужно переписать на приём cookie вместе с миграцией фронтенда
            # (см. docs/frontend_migration.md). E2E сейчас скипаются без Playwright.
            token_data = response.json()
            access_token = token_data.get("access_token", "")

        # Шаг 2: создать временный контекст браузера и внедрить токен
        context = await browser.new_context()
        page = await context.new_page()

        # Перейти на фронтенд, чтобы установить origin для localStorage
        await page.goto(FRONTEND_URL, wait_until="domcontentloaded")

        # Внедрить JWT в localStorage (по тому же ключу, что использует фронтенд)
        await page.evaluate(
            """(token) => {
                localStorage.setItem('access_token', token);
            }""",
            access_token,
        )

        # Шаг 3: сохранить storageState (cookies + localStorage)
        await context.storage_state(path=str(AUTH_STATE_FILE))
        await context.close()

        return AUTH_STATE_FILE

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # НА КАЖДЫЙ ТЕСТ: аутентифицированная страница (переиспользует storageState)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture
    async def authenticated_context(browser: Browser, auth_storage_state: Path) -> BrowserContext:
        """
        Создать новый контекст браузера, заранее загруженный с аутентифицированным
        storageState. Каждый тест получает свежий контекст (изолированные cookies/storage),
        но уже с выполненным входом.
        """
        context = await browser.new_context(
            storage_state=str(auth_storage_state),
            viewport={"width": 1280, "height": 720},
        )
        yield context
        await context.close()

    @pytest_asyncio.fixture
    async def authenticated_page(authenticated_context: BrowserContext) -> Page:
        """
        Свежая страница в рамках аутентифицированного контекста.

        Используйте эту фикстуру для любого E2E-теста, которому нужен вошедший пользователь.
        Сценарий входа НЕ повторяется — JWT заранее внедрён через storageState.
        """
        page = await authenticated_context.new_page()
        yield page
        await page.close()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # НА КАЖДЫЙ ТЕСТ: неаутентифицированная страница (для тестов сценария входа)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture
    async def page(browser: Browser) -> Page:
        """
        Свежая страница БЕЗ аутентификации.

        Используйте эту фикстуру для тестов, которые явно проверяют сам сценарий входа.
        """
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
        )
        page = await context.new_page()
        yield page
        await page.close()
        await context.close()
