"""
tests/e2e/pages/login_page.py — Page Object Model для страницы входа.

Инкапсулирует все селекторы и действия Playwright для страницы /login.
Следует паттерну POM (Page Object Model), чтобы E2E-тесты было легко поддерживать:
  • Селекторы определены ОДИН РАЗ здесь, а не разбросаны по тестам.
  • Если изменится data-testid, обновить нужно будет только этот файл.

Использование в тестах:
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
    Page Object для страницы входа Citrine Vault.

    Стратегия поиска элементов (по приоритету):
      1. атрибуты data-testid (наиболее стабильные)
      2. доступные placeholder / label
      3. CSS-селекторы (крайний случай)
    """

    # ── URL ──────────────────────────────────────────────────────────────
    URL = "/login"

    # ── Селекторы ────────────────────────────────────────────────────────
    EMAIL_INPUT = 'input[placeholder*="Email"], input[type="email"]'
    PASSWORD_INPUT = 'input[placeholder*="Пароль"], input[type="password"]'
    SUBMIT_BUTTON = 'button[type="submit"]'
    ERROR_MESSAGE = '[role="alert"], .error-message'

    def __init__(self, page: Page, base_url: str = "http://localhost:5173") -> None:
        self.page = page
        self.base_url = base_url

    async def navigate(self) -> None:
        """Перейти на страницу входа и дождаться networkidle."""
        await self.page.goto(f"{self.base_url}{self.URL}", wait_until="networkidle")

    async def fill_credentials(self, email: str, password: str) -> None:
        """Заполнить поля email и пароля."""
        await self.page.fill(self.EMAIL_INPUT, email)
        await self.page.fill(self.PASSWORD_INPUT, password)

    async def submit(self) -> None:
        """Нажать кнопку отправки формы/входа."""
        await self.page.click(self.SUBMIT_BUTTON)

    async def login(self, email: str, password: str) -> None:
        """Удобный метод: заполнение + отправка одним вызовом."""
        await self.fill_credentials(email, password)
        await self.submit()

    async def expect_dashboard_visible(self, timeout: int = 10_000) -> None:
        """
        Проверить, что после входа виден заголовок дашборда 'Общее состояние'.

        Это означает успешную аутентификацию и редирект на /.
        """
        dashboard_heading = self.page.locator("text=Общее состояние")
        await expect(dashboard_heading).to_be_visible(timeout=timeout)

    async def expect_error_visible(self, timeout: int = 5_000) -> None:
        """Проверить, что отображается сообщение об ошибке входа."""
        error_el = self.page.locator(self.ERROR_MESSAGE)
        await expect(error_el).to_be_visible(timeout=timeout)

    async def get_error_text(self) -> str:
        """Вернуть текстовое содержимое элемента с сообщением об ошибке."""
        error_el = self.page.locator(self.ERROR_MESSAGE).first
        return await error_el.text_content() or ""
