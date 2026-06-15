import time
from playwright.sync_api import Page, expect


def test_full_auth_and_secops_lifecycle_e2e_optimized(page: Page) -> None:
    page.on("console", lambda msg: print(f"\n[BROWSER CONSOLE] {msg.type}: {msg.text}"))
    page.on("pageerror", lambda err: print(f"\n[BROWSER ERROR] {err}"))

    test_email = f"architect_{int(time.time())}@citrinevault.ru"
    test_password = "StrictPassword123!"

    try:
        # ==========================================
        # Шаг 1. Переход на страницу регистрации
        # ==========================================
        page.goto("/register")
        expect(page.locator("form").first).to_be_visible(timeout=10000)

        # ==========================================
        # Шаг 2. Заполнение формы
        # ==========================================
        page.get_by_placeholder("Полное имя", exact=False).fill("Иван Архитекторов")
        page.get_by_placeholder("Email", exact=False).fill(test_email)
        page.get_by_placeholder("Пароль", exact=True).fill(test_password)

        confirm_input = page.get_by_placeholder("Подтвердите пароль", exact=False)
        if confirm_input.is_visible():
            confirm_input.fill(test_password)

        # Кликаем по кнопке отправки
        page.get_by_role("button", name="Зарегистрироваться", exact=True).click()

        # ==========================================
        # Шаг 3. Верификация дашборда (Авто-логин сработал!)
        # ==========================================
        # Ожидаем редирект в корень (Dashboard)
        page.wait_for_url("**/", timeout=10000)

        # Убеждаемся, что боковая панель Sidebar (защищенная зона) успешно отрендерилась
        expect(page.locator("aside")).to_be_visible(timeout=10000)

    except Exception as e:
        page.screenshot(path="error_screenshot.png", full_page=True)
        print(
            "\n[DIAGNOSTIC] Тест упал. Скриншот сохранен: e2e_tests/error_screenshot.png"
        )
        raise e
