# 🧪 E2E Test Suite — Electro-Treasur / Citrine Vault

Изолированный микросервис E2E-автоматизации на базе **Python + Pytest + Playwright**.

```
e2e_tests/
├── conftest.py              ← Shared fixtures (base_url, browser context, login_page)
├── pytest.ini               ← Pytest configuration (asyncio_mode, markers, testpaths)
├── requirements.txt         ← Dependencies
├── pages/
│   ├── __init__.py
│   └── login_page.py        ← LoginPage (Page Object Model)
└── tests/
    ├── __init__.py
    └── test_auth_flow.py    ← Auth E2E tests (TC-001 … TC-004)
```

---

## ⚡ Быстрый старт

### 1. Создай и активируй виртуальное окружение

> Выполняй команды из папки `e2e_tests/`

```bash
# Создать venv (один раз)
python -m venv .venv

# Активировать (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Активировать (Windows CMD)
.venv\Scripts\activate.bat

# Активировать (macOS / Linux)
source .venv/bin/activate
```

### 2. Установи зависимости

```bash
pip install -r requirements.txt
```

### 3. Установи браузеры Playwright

```bash
# Установить все браузеры (Chromium, Firefox, WebKit)
playwright install

# Или только Chromium (быстрее, хватит для начала)
playwright install chromium
```

---

## 🚀 Запуск тестов

> **Перед запуском убедись, что фронтенд запущен:** `http://localhost:5173`

```bash
# Запустить все тесты
pytest

# Запустить только smoke-тесты (TC-001, TC-002)
pytest -m smoke

# Запустить конкретный файл
pytest tests/test_auth_flow.py

# Запустить в headed-режиме (видишь браузер)
pytest --headed

# Запустить в slow-motion (замедленный режим — удобно при отладке)
pytest --headed --slowmo=500

# Записать видео провала теста
pytest --video=on

# Использовать Firefox вместо Chromium
pytest --browser=firefox
```

---

## 📋 Тест-кейсы

| ID | Маркер | Описание | Статус |
|----|--------|----------|--------|
| TC-001 | `smoke, auth` | Login page renders — все UI-элементы присутствуют | ✅ Готов |
| TC-002 | `smoke, auth` | Tab navigation: Вход → Регистрация | ✅ Готов |
| TC-003 | `auth` | Успешный вход → редирект на `/` | ⬜ Заполни данные |
| TC-004 | `auth` | Неверный пароль → toast с ошибкой | ⬜ Заполни данные |

---

## ✍️ Как дополнить TC-003 (Успешный вход)

1. Создай тестового пользователя (см. `backend/populate_test_data.py`)
2. Открой [`tests/test_auth_flow.py`](tests/test_auth_flow.py)
3. В функции `test_successful_login` замени:
   ```python
   TEST_EMAIL    = "your_test_user@example.com"   # ← твой email
   TEST_PASSWORD = "your_test_password"            # ← твой пароль
   ```
4. Раскомментируй строки `login.submit()` и блок `expect(...)`
5. Удали `pytest.skip(...)`
6. Запусти: `pytest tests/test_auth_flow.py::test_successful_login --headed`

---

## 🔬 Page Object Model (POM)

Вместо написания `page.get_by_placeholder("Email").fill(...)` в каждом тесте,
используй `LoginPage` из [`pages/login_page.py`](pages/login_page.py):

```python
from pages.login_page import LoginPage

def test_example(page):
    login = LoginPage(page)
    login.navigate()
    login.fill_credentials("user@example.com", "pass")
    login.submit()
```

Это делает тесты **читаемыми**, а при изменении DOM — правишь только POM-класс.

---

## 🗺️ Следующие шаги

```
pages/
├── register_page.py     ← RegisterPage POM (твоё домашнее задание)
├── dashboard_page.py    ← DashboardPage POM
└── transaction_page.py  ← TransactionPage POM

tests/
├── test_auth_flow.py    ← ✅ уже есть
├── test_dashboard.py    ← добавишь после LoginPage
└── test_transactions.py ← добавишь позже
```

---

> **Tip:** используй `pytest --headed --slowmo=1000` при первом запуске —
> ты увидишь, как Playwright реально ведёт браузер по шагам теста.
