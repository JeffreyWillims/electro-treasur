"""
tests/e2e/test_user_journey.py — Сквозной пользовательский сценарий (Playwright).

Тестирует полный поток вход → дашборд через настоящий браузер.

Предварительные условия:
  • Запущен dev-сервер фронтенда: `npm run dev` (localhost:5173)
  • Запущен backend API: `uvicorn src.main:app` (localhost:8000)
  • В базе данных должен существовать пользователь с известными учётными данными
  • Установлены браузеры Playwright: `npx playwright install chromium`

Запуск:
  pytest tests/e2e/ --headed          # смотреть за браузером
  pytest tests/e2e/ -k test_login     # запустить конкретный тест

Архитектура:
  ┌──────────────────────────────────────────────────┐
  │  E2E-тест (вершина пирамиды)                     │
  │                                                  │
  │  Браузер Playwright ──→ Фронтенд (Vite)          │
  │       ↓                      ↓                   │
  │  Заполнить форму входа  fetch('/api/v1/auth')    │
  │       ↓                      ↓                   │
  │  Отправить              Backend (FastAPI)         │
  │       ↓                      ↓                   │
  │  Ожидать редирект       PostgreSQL + Redis       │
  │  "Общее состояние"                               │
  └──────────────────────────────────────────────────┘

ПРИМЕЧАНИЕ: E2E-тесты МЕДЛЕННЫЕ и ХРУПКИЕ по своей природе. Держите их
      минимальными — проверяйте только критичные пользовательские сценарии,
      а не граничные случаи.
"""

from __future__ import annotations

import pytest

# Пропустить весь модуль на этапе сбора тестов, если playwright не установлен.
# (хуки tests/e2e/conftest.py срабатывают ПОСЛЕ импорта модуля — они не могут
#  предотвратить ImportError здесь, поэтому проверка должна быть в самом модуле.)
pytest.importorskip("playwright")

from playwright.async_api import Page  # noqa: E402

from tests.e2e.pages.login_page import LoginPage  # noqa: E402

# ── Configuration ────────────────────────────────────────────────────────────
FRONTEND_URL = "http://localhost:5173"
TEST_USER_EMAIL = "vault-tester@citrine.dev"
TEST_USER_PASSWORD = "TestPass123!"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SMOKE TEST — Login → Dashboard
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest.mark.e2e
class TestUserLoginJourney:
    """
    Critical path: User opens the app → logs in → sees the dashboard.

    This is the single most important user flow. If this breaks,
    the entire product is unusable.
    """

    async def test_successful_login_redirects_to_dashboard(self, page: Page) -> None:
        """
        GIVEN a registered user with valid credentials
        WHEN  they navigate to /login, fill email+password, and submit
        THEN  they are redirected to the dashboard
        AND   the heading 'Общее состояние' is visible
        """
        login_page = LoginPage(page, base_url=FRONTEND_URL)

        # Navigate to login
        await login_page.navigate()

        # Fill credentials and submit
        await login_page.login(TEST_USER_EMAIL, TEST_USER_PASSWORD)

        # Expect dashboard to appear (redirect + data load)
        await login_page.expect_dashboard_visible(timeout=15_000)

    async def test_invalid_credentials_show_error(self, page: Page) -> None:
        """
        GIVEN an invalid email/password combination
        WHEN  the user attempts to log in
        THEN  an error message is displayed (no redirect)
        AND   the URL still contains /login
        """
        login_page = LoginPage(page, base_url=FRONTEND_URL)

        await login_page.navigate()
        await login_page.login("nonexistent@test.dev", "WrongPassword!")

        # Should show an error, NOT redirect
        await login_page.expect_error_visible(timeout=5_000)

        # URL should still be on login page
        assert "/login" in page.url, f"Expected to stay on /login, but navigated to: {page.url}"
