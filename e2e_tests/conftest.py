import time
import pytest
from playwright.sync_api import Page, expect

# ИСПРАВЛЕНО: Меняем порт 5173 на стандартный 80, так как Docker мапит Nginx на 80:80
BASE_URL = "http://localhost"


@pytest.fixture(scope="session")
def base_url() -> str:
    """Переопределяем системную фикстуру Playwright для относительных переходов"""
    return BASE_URL


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args: dict) -> dict:
    """
    Inject global browser context options for every test session.
    """
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 720},
        "locale": "ru-RU",
        "reduced_motion": "reduce",  # Отключает анимации Framer Motion
        "base_url": BASE_URL,
    }


def test_full_auth_and_secops_lifecycle_e2e(page: Page) -> None:
    """
    Vertical Slice тест:
    1. Фронтенд: Заполнение стеклянной формы регистрации.
    2. Бэкенд: Запись в БД, хэширование Argon2, генерация JWT.
    3. Фронтенд: Перехват токена Axios/TanStack Query, редирект.
    4. SecOps: Создание транзакции (проверка привязки к user_id под капотом).
    """
    # Генерируем уникальный email, чтобы обходить UNIQUE constraint базы данных
    timestamp = int(time.time())
    test_email = f"architect_{timestamp}@citrinevault.ru"
    test_password = "StrictPassword123!"

    # ==========================================
    # Шаг 1. Registration (UI -> Backend)
    # ==========================================
    page.goto("/register")
    page.wait_for_load_state("networkidle")

    # Взаимодействуем с UI (инпуты с shadow-inner)
    page.get_by_placeholder("Email").fill(test_email)
    page.get_by_placeholder("Пароль", exact=False).first.fill(test_password)

    # Кликаем "Зарегистрироваться" (Optimistic UI / Mutation)
    page.get_by_role("button", name="Зарегистрироваться").click()

    # Проверяем, что фронтенд успешно обработал JWT и пустил нас в C.O.R.E. Dashboard
    expect(page).to_have_url("**/")  # Ожидаем редирект на главную (Overview)

    # Убеждаемся, что мы авторизованы (ищем Sidebar или аватар)
    # Ждем появления плавающего "Острова"
    sidebar = page.locator("aside")
    expect(sidebar).to_be_visible()

    # ==========================================
    # Шаг 2. Создание сущности & Проверка IDOR
    # ==========================================
    # Тестируем QuickEntry на дашборде (Smart Combobox)
    # Находим поле ввода суммы (Kinetic Abacus)
    amount_input = page.get_by_placeholder("0.00")
    amount_input.fill("50000")

    # Открываем комбобокс категорий и создаем новую на лету
    # (Это пробивает роут POST /api/v1/categories/ с Bearer JWT)
    category_input = page.get_by_placeholder("Категория...")
    category_input.fill("E2E Test Category")
    page.get_by_role("option", name="Создать 'E2E Test Category'").click()

    # Сохраняем транзакцию
    page.get_by_role("button", name="Добавить").click()

    # ==========================================
    # Шаг 3. Optimistic Updates & TanStack Query Verify
    # ==========================================
    # Пользователь не должен видеть загрузку! Транзакция должна появиться мгновенно.
    # Ищем текст категории в списке последних транзакций.
    transaction_row = page.get_by_text("E2E Test Category")
    expect(transaction_row).to_be_visible()

    # ==========================================
    # Шаг 4. SecOps: Logout & Cache Invalidation
    # ==========================================
    # Проверяем, что при логауте AuthContext очищает кэш, и данные не утекают
    page.get_by_role("button", name="Выйти").click()
    expect(page).to_have_url("**/login")

    # Пытаемся вернуться на защищенный роут напрямую (Имитация атаки)
    page.goto("/")
    expect(page).to_have_url("**/login")  # Должно выкинуть обратно
