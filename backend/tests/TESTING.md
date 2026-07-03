# 🧪 Citrine Vault — Test Framework Documentation

> Полная документация по тестовому фреймворку проекта Citrine Vault.
> Версия: 2.0 | Тестов: **270** | Покрытие: **~90%**

---

## 📊 Обзор

```
Unit Tests:      198 ████████████████████████████████████████  73%
Integration:      72 ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░  27%
──────────────────────────────────────────────────────────────────
TOTAL:           270 тестов
```

### Быстрый запуск

```bash
# Unit-тесты (без БД, без Docker)
pytest tests/unit/ -v

# Integration-тесты (требует PostgreSQL)
docker-compose up -d postgres
pytest tests/integration/ -v

# Все тесты
pytest tests/ -v

# Только OCR парсинг
pytest tests/unit/test_ocr_parsing.py -v

# С покрытием
pytest tests/unit/ --cov=src --cov-report=html
```

---

## 🏗️ Архитектура

```
tests/
├── conftest.py                  # Core fixtures (engine, session, client, auth)
├── factories/
│   └── transactions.py          # factory-boy: TransactionCreateFactory, CategoryFactory
├── unit/                        # 198 тестов — без БД, без I/O
│   ├── test_ocr_parsing.py      #  81 — Распознавание чеков/выписок (Tesseract)
│   ├── test_telegram_helpers.py #  37 — Telegram handler pure functions
│   ├── test_auth_service.py     #  21 — JWT + Argon2 хэширование
│   ├── test_schemas.py          #  19 — Pydantic V2 валидация
│   ├── test_import_helpers.py   #  17 — CSV/Excel column aliasing + парсинг
│   ├── test_analytics.py        #  11 — Savings Simulator (compound interest)
│   ├── test_budget_math.py      #   7 — Budget aggregation math
│   └── test_services.py         #   5 — Dashboard aggregation + fake repo
├── integration/                 # 72 теста — требует PostgreSQL
│   ├── conftest.py              # Auto-skip guard (PG offline → skip)
│   ├── test_api_full.py         #  35 — Full CRUD API (HTTP→Route→Service→DB)
│   ├── test_user_service.py     #  15 — User CRUD + category cascade
│   ├── test_import_export.py    #  11 — CSV import/export roundtrip
│   ├── test_repositories.py     #  10 — ORM constraints (UNIQUE, CASCADE, NUMERIC)
│   └── test_api.py              #   5 — Legacy transaction API tests (POST only)
└── e2e/                         # 2 теста — требует Playwright + полный стек
    └── test_user_journey.py     #   2 — Регистрация → логин через браузер
```

---

## 🔧 Core Infrastructure

### Nested Savepoint Isolation Pattern

Главная инновация фреймворка — **нулевая межтестовая контаминация** без пересоздания БД:

```
┌──────────────────────────────────────────────┐
│  CONNECTION TRANSACTION (never committed)     │ ← db_connection
│  ┌──────────────────────────────────────────┐ │
│  │  SAVEPOINT (rolled back after each test) │ │ ← db_session
│  │  ┌────────────────────────────────────┐  │ │
│  │  │ test_create_user()                 │  │ │
│  │  │ session.add(User(...))             │  │ │
│  │  │ await session.flush()  ← visible   │  │ │
│  │  └────────────────────────────────────┘  │ │
│  │  ROLLBACK TO SAVEPOINT ← erases all      │ │
│  └──────────────────────────────────────────┘ │
│  ROLLBACK ← connection returns clean          │
└──────────────────────────────────────────────┘
```

| Характеристика | Значение |
|---|---|
| **Изоляция** | Hermetic — каждый тест работает в чистой БД |
| **Скорость очистки** | O(1) — ROLLBACK вместо DROP/CREATE |
| **Диалект** | Real PostgreSQL (не SQLite) |
| **FastAPI override** | `get_db()` → savepoint session |

### Fixtures (conftest.py)

| Fixture | Scope | Описание |
|---|---|---|
| `_create_tables` | session | CREATE ALL / DROP ALL (1 раз за прогон) |
| `db_connection` | function | Raw connection с uncommitted transaction |
| `db_session` | function | AsyncSession с SAVEPOINT |
| `async_client` | function | httpx.AsyncClient + FastAPI app (DI override) |
| `test_user` | function | User `vault-tester@citrine.dev` / `TestPass123!` |
| `auth_headers` | function | JWT Bearer headers для test_user |

### Auto-Skip Guard

```python
# tests/integration/conftest.py
# Если PostgreSQL недоступен → все integration-тесты пропускаются с сообщением
# "PostgreSQL not reachable — integration tests skipped"
# Unit-тесты продолжают работать нормально
```

**Результат:** `198 passed, 72 skipped` (PG offline) vs `270 passed` (PG online)

---

## 📋 Детальное описание тестов

### Unit Tests (198)

#### `test_ocr_parsing.py` — 81 тест

Самый большой тестовый файл. Покрывает пайплайн распознавания чеков (`ai_vision_service.py`):

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestSafeParseAmount` | 15 | Парсинг сумм: RU (`1 500,00`), US (`1,500.00`), EU, edge cases |
| `TestReceiptRegex` | 20 | Regex-паттерны для чеков: "ИТОГО", "СУММА", дата, описание |
| `TestBankStatementParsing` | 15 | Парсинг банковских выписок (Сбер, Тинькофф) |
| `TestOCRNoiseResilience` | 10 | Устойчивость к OCR-шуму: `₽`, `Рр`, спецсимволы |
| `TestOutputContract` | 5 | Контракт: amounts > 0, type ∈ {income, expense}, len(desc) ≤ 255 |
| `TestHypothesisRegexSafety` | 3 | Property-based: парсер не падает на произвольном тексте |

**Технологии:** `pytest.mark.parametrize`, `hypothesis` (property-based testing)

---

#### `test_telegram_helpers.py` — 37 тестов

Чистые функции из Telegram handlers (без Bot, без I/O):

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestGetRuMonth` | 7 | Русские названия месяцев: `date(2026, 1, 15)` → `"Январь 2026"` |
| `TestCleanCatName` | 6 | HEX-очистка: `"#8B5CF6 стики"` → `"стики"` |
| `TestFixLayout` | 5 | EN→RU раскладка: `"ghjlerns"` → `"продукты"` |
| `TestLocCategory` | 4 | Локализация: `"Operations (Rent/Utility)"` → `"🏠 Базовые расходы"` |
| `TestDisplayCat` | 4 | Emoji injection: `"Здоровье"` → `"❤️ Здоровье"` |
| `TestGetCurrentMonthRange` | 4 | Первый/последний день месяца |
| `TestAttr` | 4 | Universal getter для dict + object |
| `TestCategorySynonyms` | 3 | Консистентность данных: все synonyms → TRANSLATIONS |

---

#### `test_auth_service.py` — 21 тест

JWT-токены и Argon2 хэширование:

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestCreateAccessToken` | 8 | JWT creation, subject, expiry, extra claims, immutability |
| `TestDecodeAccessToken` | 5 | Valid decode, expired, missing sub, tampered, garbage |
| `TestPasswordHashing` | 8 | Argon2 format, salt randomness, verify correct/wrong/empty/unicode/long |

---

#### `test_schemas.py` — 19 тестов

Pydantic V2 валидация (NUMERIC(12,2) constraints):

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestTransactionCreate` | 10 | Boundaries, required fields, defaults, max_digits |
| `TestTransactionUpdate` | 5 | `exclude_unset`, partial update, None vs missing |
| `TestTransactionResponse` | 2 | `from_attributes`, optional defaults |
| `TestTransactionPaginatedResponse` | 2 | Empty page, items page |

---

#### `test_import_helpers.py` — 17 тестов

CSV/Excel импорт helper-функции:

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestResolveColumns` | 8 | EN/RU заголовки, case-insensitive, missing required, aliases |
| `TestParseAmount` | 9 | int, float, Decimal, spaces, comma-decimal, negative |

---

#### `test_analytics.py` — 11 тестов

Симулятор накоплений (compound interest):

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestSimulateSavings` | 11 | Рост с %, оптимизация расходов, habit_savings, 0% rate, 120-month cap |

---

#### `test_budget_math.py` — 7 тестов

Математика бюджетных агрегаций:

| Тестов | Что проверяет |
|---|---|
| 7 | Budget vs actual, overflow detection, multiple categories |

---

#### `test_services.py` — 5 тестов

Dashboard aggregation с fake repository:

| Тестов | Что проверяет |
|---|---|
| 5 | Aggregation correctness, day vectors, empty repo, execution speed <10ms |

---

### Integration Tests (72)

#### `test_api_full.py` — 35 тестов

**Full HTTP → Route → Service → ORM → PostgreSQL pipeline:**

| Класс | Тестов | Endpoints |
|---|---|---|
| `TestHealthcheck` | 1 | `GET /v1/health` |
| `TestTransactionGet` | 5 | `GET /v1/transactions/` (list, pagination, filter, 401) |
| `TestTransactionPatch` | 3 | `PATCH /v1/transactions/{id}` (amount, comment, 404) |
| `TestTransactionDelete` | 3 | `DELETE /v1/transactions/{id}` (204, 404, double-delete) |
| `TestBudgetEndpoints` | 4 | `PUT/DELETE /v1/budgets/` (upsert, update, delete, 404) |
| `TestUserProfile` | 3 | `GET/PATCH /v1/users/me` (read, update, 401) |
| `TestUserCategories` | 6 | `POST/GET/PATCH/DELETE /v1/users/categories` |
| `TestAuthFlow` | 5 | `POST /v1/auth/register` + `POST /v1/auth/login` |
| `TestExportEndpoint` | 1 | `GET /v1/transactions/export` (CSV) |

---

#### `test_user_service.py` — 15 тестов

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestCreateUser` | 3 | Argon2 hash, 6 default categories, zero income |
| `TestGetUserByEmail` | 2 | Found / None |
| `TestUpdateUserProfile` | 3 | full_name, monthly_income, phone |
| `TestCategoryCrud` | 7 | Create, update, ownership(-1), cascade TX+Budget, delete |

---

#### `test_import_export.py` — 11 тестов

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestImportTransactions` | 8 | CSV→DB, auto-category, idempotency dedup, RU headers, zero-skip |
| `TestExportTransactionsCsv` | 3 | Empty export, data roundtrip, UTF-8 BOM |

---

#### `test_repositories.py` — 10 тестов

| Класс | Тестов | Что проверяет |
|---|---|---|
| `TestTransactionIdempotency` | 2 | UNIQUE `idempotency_key`, NULL allowed |
| `TestUserConstraints` | 2 | UNIQUE email, UNIQUE telegram_chat_id |
| `TestBudgetConstraints` | 2 | UNIQUE per month, different months OK |
| `TestCascadeDeletes` | 2 | User→TX cascade, Category→TX cascade |
| `TestNumericPrecision` | 2 | NUMERIC(12,2) precision, monthly_income |

---

### E2E Tests (2)

| Тест | Что проверяет |
|---|---|
| `test_register_flow` | Полный регистрационный флоу через Playwright |
| `test_login_flow` | Логин + редирект на дашборд |

> **Требования:** `pip install playwright && playwright install chromium`

---

## 🔬 Технологии и паттерны

| Технология | Применение |
|---|---|
| **pytest** | Core test runner |
| **pytest-asyncio** | Async test support (mode=auto) |
| **hypothesis** | Property-based testing (OCR fuzzing) |
| **factory-boy** | Test data factories |
| **httpx** | Async HTTP client для FastAPI |
| **Playwright** | E2E browser testing |

### Паттерны

| Паттерн | Где используется |
|---|---|
| **Nested Savepoint Isolation** | conftest.py — zero inter-test contamination |
| **Dependency Override** | FastAPI DI → savepoint session + fake Redis |
| **Property-Based Testing** | `test_ocr_parsing.py` — fuzzing с Hypothesis |
| **Factory Pattern** | `factories/transactions.py` — factory-boy |
| **Auto-Skip Guard** | `integration/conftest.py` — PG offline → skip |
| **Safety Guard** | Main conftest — asserts `_test` suffix on DB URL |
| **Fake Repository** | `test_services.py` — in-memory repo для dashboard |

---

## ⚡ Производительность

| Метрика | Значение |
|---|---|
| Unit-тесты (198) | **~17 секунд** |
| Integration (72) | **~45 секунд** (с PG) |
| Полный прогон | **~65 секунд** |
| Очистка per-test | **O(1)** (ROLLBACK, не DROP) |

---

## 🛡️ Безопасность тестов

1. **Production DB Guard** — `assert database_url.endswith("_test")` предотвращает запуск тестов на проде
2. **Auto-skip** — отсутствие PG не ломает CI для unit-тестов
3. **Fake Redis** — `AsyncMock` заменяет Redis без внешних зависимостей
4. **Hermetic isolation** — SAVEPOINT гарантирует чистую БД каждому тесту

---

## 📈 CI/CD интеграция

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    steps:
      - name: Unit Tests
        run: pytest tests/unit/ -v --tb=short

      - name: Integration Tests
        run: pytest tests/integration/ -v --tb=short
        # Auto-skips if PG service is not configured
```

### Рекомендуемые pytest markers

```ini
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
]
```

---

## 📦 Зависимости (test-only)

```
pytest>=8.0
pytest-asyncio>=0.23
pytest-cov
hypothesis>=6.0
factory-boy>=3.3
httpx>=0.27
playwright  # только для E2E
```
