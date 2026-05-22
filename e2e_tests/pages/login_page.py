"""
pages/login_page.py — Page Object Model for /login route.

Encapsulates all locators and interactions for the Citrine Vault login screen.
Tests should use this class instead of raw locators to stay DRY and resilient.

DOM Reference (LoginForm.tsx):
    - Brand badge:        text="Citrine Vault"
    - Active tab:         text="Вход"
    - Email input:        placeholder="Email"
    - Password input:     placeholder="Пароль"
    - Submit button:      text="Войти в аккаунт"
    - Register link:      text="Регистрация"  →  navigates to /register
"""

from playwright.sync_api import Page, Locator


class LoginPage:
    """
    Page Object for the /login route.

    Usage in tests:
        def test_example(page: Page) -> None:
            login = LoginPage(page)
            login.navigate()
            login.fill_credentials("user@example.com", "secret")
            login.submit()
    """

    URL = "/login"

    def __init__(self, page: Page) -> None:
        self._page = page

        # ── Locators (resolved lazily by Playwright) ──────────────────────
        self.brand_badge: Locator       = page.get_by_text("Citrine Vault")
        self.tab_login: Locator         = page.get_by_text("Вход", exact=True)
        self.tab_register: Locator      = page.get_by_text("Регистрация", exact=True)
        self.email_input: Locator       = page.get_by_placeholder("Email")
        self.password_input: Locator    = page.get_by_placeholder("Пароль")
        self.submit_button: Locator     = page.get_by_text("Войти в аккаунт")

    # ── Actions ───────────────────────────────────────────────────────────

    def navigate(self) -> None:
        """Navigate to /login and wait for network idle."""
        self._page.goto(self.URL)
        self._page.wait_for_load_state("networkidle")

    def fill_credentials(self, email: str, password: str) -> None:
        """Fill email + password fields."""
        self.email_input.fill(email)
        self.password_input.fill(password)

    def submit(self) -> None:
        """Click the submit button and wait for navigation."""
        self.submit_button.click()
        self._page.wait_for_load_state("networkidle")

    def login(self, email: str, password: str) -> None:
        """Composite helper: fill credentials and submit."""
        self.fill_credentials(email, password)
        self.submit()

    def go_to_register(self) -> None:
        """Click the Register tab to navigate to /register."""
        self.tab_register.click()
        self._page.wait_for_url("**/register")
