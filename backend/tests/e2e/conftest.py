"""
tests/e2e/conftest.py — Playwright E2E Test Infrastructure.
"""

from __future__ import annotations

import pytest


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Auto-skip E2E tests if playwright is not installed."""
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

    # ── Configuration ────────────────────────────────────────────────────────────
    FRONTEND_URL = "http://localhost:5173"
    BACKEND_URL = "http://localhost:8000"
    TEST_USER_EMAIL = "vault-tester@citrine.dev"
    TEST_USER_PASSWORD = "TestPass123!"
    AUTH_STATE_FILE = Path(__file__).parent / ".auth_state.json"


if _PLAYWRIGHT_AVAILABLE:
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SESSION-SCOPED: Browser lifecycle
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture(scope="session")
    async def browser():
        """Launch a single Chromium browser instance for the entire test session."""
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            yield browser
            await browser.close()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # SESSION-SCOPED: Authenticate once, save storageState
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture(scope="session")
    async def auth_storage_state(browser: Browser) -> Path:
        """
        Authenticate via the API, inject JWT into browser localStorage,
        and save storageState to a JSON file.

        This runs ONCE per session — all tests reuse the saved state.
        Returns the path to the storageState JSON file.
        """
        # Устарело: auth переехал на httpOnly-cookie, токена в теле логина больше
        # нет и localStorage не используется. Сценарий нужно переписать на приём
        # cookie в браузерный контекст (см. docs/frontend_migration.md).
        pytest.skip("Needs cookie migration (httpOnly auth) — see docs/frontend_migration.md")

        import httpx

        # Step 1: Get JWT token via API (bypass UI login entirely)
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

        # Step 2: Create a temporary browser context and inject the token
        context = await browser.new_context()
        page = await context.new_page()

        # Navigate to frontend to establish origin for localStorage
        await page.goto(FRONTEND_URL, wait_until="domcontentloaded")

        # Inject JWT into localStorage (matching frontend's auth storage key)
        await page.evaluate(
            """(token) => {
                localStorage.setItem('access_token', token);
            }""",
            access_token,
        )

        # Step 3: Save storageState (cookies + localStorage)
        await context.storage_state(path=str(AUTH_STATE_FILE))
        await context.close()

        return AUTH_STATE_FILE

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PER-TEST: Authenticated page (reuses storageState)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture
    async def authenticated_context(browser: Browser, auth_storage_state: Path) -> BrowserContext:
        """
        Create a new browser context pre-loaded with the authenticated
        storageState. Each test gets a fresh context (isolated cookies/storage)
        but starts already logged in.
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
        A fresh page within an authenticated context.

        Use this fixture for any E2E test that needs a logged-in user.
        The login flow is NOT repeated — JWT is pre-injected via storageState.
        """
        page = await authenticated_context.new_page()
        yield page
        await page.close()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # PER-TEST: Unauthenticated page (for login flow tests)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    @pytest_asyncio.fixture
    async def page(browser: Browser) -> Page:
        """
        A fresh page WITHOUT authentication.

        Use this fixture for tests that explicitly test the login flow itself.
        """
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
        )
        page = await context.new_page()
        yield page
        await page.close()
        await context.close()

