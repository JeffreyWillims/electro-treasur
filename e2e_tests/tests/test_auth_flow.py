"""
test_auth_flow.py — E2E Tests for Authentication Flow.

Покрываемые сценарии:
    ✅ TC-001: Страница /login загружается и отображает правильный UI
    ✅ TC-002: Навигация по вкладкам (Вход → Регистрация)
    ⬜ TC-003: Успешный вход (заполни TEST_EMAIL / TEST_PASSWORD)
    ⬜ TC-004: Неверный пароль → toast с ошибкой
    ⬜ TC-005: Редирект авторизованного пользователя с /login → /

Как дополнить тесты:
    1. Задай TEST_EMAIL и TEST_PASSWORD (или передай через env-переменные).
    2. Раскомментируй TC-003 и TC-004.
    3. Запусти: pytest tests/test_auth_flow.py -v

DOM Reference (LoginForm.tsx):
    brand badge  → text "Citrine Vault"
    tab active   → text "Вход"
    tab inactive → text "Регистрация"
    email input  → placeholder="Email"
    password     → placeholder="Пароль"
    submit btn   → text "Войти в аккаунт"
"""

import pytest
from playwright.sync_api import Page, expect

from pages.login_page import LoginPage


# ── Test Configuration ────────────────────────────────────────────────────
BASE_URL = "http://localhost:5173"

# TODO: замени на реальные данные тестового пользователя (или используй env)
# import os
# TEST_EMAIL    = os.getenv("E2E_USER_EMAIL", "testuser@example.com")
# TEST_PASSWORD = os.getenv("E2E_USER_PASSWORD", "supersecret")


# ═════════════════════════════════════════════════════════════════════════════
#  TC-001 | SMOKE | Login page renders correctly
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.smoke
@pytest.mark.auth
def test_login_page_renders(page: Page) -> None:
    """
    TC-001: Открыть /login и убедиться, что ключевые UI-элементы присутствуют.

    Assertions:
        - URL содержит /login
        - Виден бренд-бейдж "Citrine Vault"
        - Активна вкладка "Вход"
        - Поле Email видно и пустое
        - Поле Пароль видно и пустое
        - Кнопка "Войти в аккаунт" видна и доступна (not disabled)
    """
    login = LoginPage(page)
    login.navigate()

    # ── 1. URL ───────────────────────────────────────────────────────────
    expect(page).to_have_url(f"{BASE_URL}/login")

    # ── 2. Бренд-бейдж ───────────────────────────────────────────────────
    expect(login.brand_badge).to_be_visible()

    # ── 3. Активная вкладка "Вход" ────────────────────────────────────────
    expect(login.tab_login).to_be_visible()

    # ── 4. Поле Email ─────────────────────────────────────────────────────
    expect(login.email_input).to_be_visible()
    expect(login.email_input).to_be_empty()

    # ── 5. Поле Пароль ───────────────────────────────────────────────────
    expect(login.password_input).to_be_visible()
    expect(login.password_input).to_be_empty()

    # ── 6. Кнопка submit ─────────────────────────────────────────────────
    expect(login.submit_button).to_be_visible()
    expect(login.submit_button).to_be_enabled()


# ═════════════════════════════════════════════════════════════════════════════
#  TC-002 | SMOKE | Tab navigation: Login → Register
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.smoke
@pytest.mark.auth
def test_tab_navigation_to_register(page: Page) -> None:
    """
    TC-002: Кликнуть по вкладке "Регистрация" и убедиться, что
    происходит переход на /register.

    Это проверяет, что React Router и Auth-контекст корректно
    обрабатывают публичные маршруты.
    """
    login = LoginPage(page)
    login.navigate()

    # Вкладка "Регистрация" должна быть видна
    expect(login.tab_register).to_be_visible()

    # Клик → переход на /register
    login.go_to_register()

    expect(page).to_have_url(f"{BASE_URL}/register")


# ═════════════════════════════════════════════════════════════════════════════
#  TC-003 | AUTH | Успешный вход (ДОПОЛНИ СЮДА!)
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.auth
def test_successful_login(page: Page) -> None:
    """
    TC-003: Ввести корректные учётные данные и проверить редирект на /

    ─── КАК ДОПОЛНИТЬ ───────────────────────────────────────────────────────
    1. Создай тестового пользователя через API или populate_test_data.py.
    2. Замени email и password на реальные.
    3. После login.submit() добавь проверку:
           expect(page).to_have_url(f"{BASE_URL}/")
           expect(page.get_by_text("V.I.A.")).to_be_visible()
    ─────────────────────────────────────────────────────────────────────────
    """
    login = LoginPage(page)
    login.navigate()

    # TODO: замени на реальные тестовые данные
    TEST_EMAIL = "your_test_user@example.com"
    TEST_PASSWORD = "your_test_password"

    # Шаг 1: Заполни поля
    login.fill_credentials(TEST_EMAIL, TEST_PASSWORD)

    # Шаг 2: Убедись, что поля заполнены корректно
    expect(login.email_input).to_have_value(TEST_EMAIL)
    expect(login.password_input).to_have_value(TEST_PASSWORD)

    # Шаг 3: Отправь форму
    # login.submit()

    # Шаг 4: Проверь редирект на главную
    # expect(page).to_have_url(f"{BASE_URL}/")
    # expect(page.get_by_text("V.I.A.")).to_be_visible()

    pytest.skip(
        "TC-003: Установи тестовые данные в TEST_EMAIL/TEST_PASSWORD, "
        "раскомментируй шаги 3–4 и удали этот skip."
    )


# ═════════════════════════════════════════════════════════════════════════════
#  TC-004 | AUTH | Неверный пароль → сообщение об ошибке
# ═════════════════════════════════════════════════════════════════════════════


@pytest.mark.auth
def test_invalid_credentials_shows_error(page: Page) -> None:
    """
    TC-004: Ввести неверный пароль и проверить появление toast-уведомления.

    Sonner-тост с текстом ошибки должен появиться после неудачного login.
    ─── КАК ДОПОЛНИТЬ ───────────────────────────────────────────────────────
    1. Раскомментируй login.submit() и expect блок.
    2. Уточни текст тоста (см. LoginForm.tsx: 'Ошибка входа').
    ─────────────────────────────────────────────────────────────────────────
    """
    login = LoginPage(page)
    login.navigate()

    login.fill_credentials("wrong@example.com", "wrongpassword")

    # login.submit()

    # Ожидаем появление Sonner-тоста с ошибкой
    # toast = page.locator("[data-sonner-toast]")
    # expect(toast).to_be_visible(timeout=5000)

    pytest.skip("TC-004: Раскомментируй submit() и expect-блок для toast.")
