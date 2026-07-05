"""
tests/e2e/test_user_journey.py — End-to-End User Journey (Playwright).

Tests the complete login → dashboard flow through a real browser.

Prerequisites:
  • Frontend dev server running: `npm run dev` (localhost:5173)
  • Backend API running: `uvicorn src.main:app` (localhost:8000)
  • A user must exist in the database with known credentials
  • Playwright browsers installed: `npx playwright install chromium`

Run:
  pytest tests/e2e/ --headed          # watch the browser
  pytest tests/e2e/ -k test_login     # run specific test

Architecture:
  ┌──────────────────────────────────────────────────┐
  │  E2E Test (top of the pyramid)                   │
  │                                                  │
  │  Playwright Browser ──→ Frontend (Vite)          │
  │       ↓                      ↓                   │
  │  Fill login form        fetch('/api/v1/auth')    │
  │       ↓                      ↓                   │
  │  Submit                 Backend (FastAPI)         │
  │       ↓                      ↓                   │
  │  Expect redirect        PostgreSQL + Redis       │
  │  "Общее состояние"                               │
  └──────────────────────────────────────────────────┘

NOTE: E2E tests are SLOW and FRAGILE by design. Keep them minimal —
      only test critical user journeys, not edge cases.
"""

from __future__ import annotations

import pytest

# Skip the whole module at collection time if playwright is not installed.
# (tests/e2e/conftest.py hooks run AFTER module import — they can't prevent
#  an ImportError here, so the guard must live in the module itself.)
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
