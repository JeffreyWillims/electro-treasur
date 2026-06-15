"""
tests/e2e/pages/login_page.py — Page Object Model for the Login page.

Encapsulates all Playwright selectors and actions for the /login page.
Follows the POM (Page Object Model) pattern to keep E2E tests maintainable:
  • Selectors are defined ONCE here, not scattered across tests.
  • If a data-testid changes, only this file needs updating.

Usage in tests:
    from tests.e2e.pages.login_page import LoginPage

    async def test_login_flow(page):
        login = LoginPage(page)
        await login.navigate()
        await login.fill_credentials("user@test.dev", "pass123")
        await login.submit()
        await login.expect_dashboard_visible()
"""

from __future__ import annotations

from playwright.async_api import Page, expect


class LoginPage:
    """
    Page Object for the Citrine Vault login page.

    Locator strategy (priority order):
      1. data-testid attributes (most stable)
      2. Accessible placeholders / labels
      3. CSS selectors (last resort)
    """

    # ── URL ──────────────────────────────────────────────────────────────
    URL = "/login"

    # ── Selectors ────────────────────────────────────────────────────────
    EMAIL_INPUT = 'input[placeholder*="Email"], input[type="email"]'
    PASSWORD_INPUT = 'input[placeholder*="Пароль"], input[type="password"]'
    SUBMIT_BUTTON = 'button[type="submit"]'
    ERROR_MESSAGE = '[role="alert"], .error-message'

    def __init__(self, page: Page, base_url: str = "http://localhost:5173") -> None:
        self.page = page
        self.base_url = base_url

    async def navigate(self) -> None:
        """Navigate to the login page and wait for network idle."""
        await self.page.goto(f"{self.base_url}{self.URL}", wait_until="networkidle")

    async def fill_credentials(self, email: str, password: str) -> None:
        """Fill in email and password fields."""
        await self.page.fill(self.EMAIL_INPUT, email)
        await self.page.fill(self.PASSWORD_INPUT, password)

    async def submit(self) -> None:
        """Click the submit/login button."""
        await self.page.click(self.SUBMIT_BUTTON)

    async def login(self, email: str, password: str) -> None:
        """Convenience: fill + submit in one call."""
        await self.fill_credentials(email, password)
        await self.submit()

    async def expect_dashboard_visible(self, timeout: int = 10_000) -> None:
        """
        Assert that after login, the dashboard title 'Общее состояние' is visible.

        This indicates successful authentication and redirect to /.
        """
        dashboard_heading = self.page.locator("text=Общее состояние")
        await expect(dashboard_heading).to_be_visible(timeout=timeout)

    async def expect_error_visible(self, timeout: int = 5_000) -> None:
        """Assert that a login error message is displayed."""
        error_el = self.page.locator(self.ERROR_MESSAGE)
        await expect(error_el).to_be_visible(timeout=timeout)

    async def get_error_text(self) -> str:
        """Return the text content of the error message element."""
        error_el = self.page.locator(self.ERROR_MESSAGE).first
        return await error_el.text_content() or ""
