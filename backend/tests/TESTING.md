# 🧪 Citrine Vault — Test Framework Documentation

> Полная документация по тестовому фреймворку проекта Citrine Vault.
> Тестов: **287** (unit 205 + integration 80 + e2e 2, проверено `pytest --collect-only` на 2026-07-04).
> Покрытие: **67%** (замер 2026-07-04, полный прогон unit+integration с `--cov=src` против
> PostgreSQL 16). Порог CI — **≥70%** (`--cov-fail-under=70` передаётся ЯВНО в ci.yml,
> из локальных `addopts` флаги покрытия убраны) — **порог сейчас не достигается**,
> в основном из-за непокрытых `src/infrastructure/telegram/*` (~340 строк).

---

## 📊 Обзор

```
Unit Tests:      205 ████████████████████████████████████████  72%
Integration:      80 ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░  28%
──────────────────────────────────────────────────────────────────
TOTAL:           285 тестов (+ 2 e2e = 287 всего)
```

### Быстрый запуск

Флаги покрытия убраны из `addopts` (2026-07-04) — подмножества тестов запускаются
без `--no-cov` и без ложного фейла по порогу покрытия.

```bash
# Unit-тесты (без БД, без Docker) — теперь работают «из коробки»
pytest tests/unit -v

# Integration-тесты (требует PostgreSQL с базой electro_treasur_test)
docker compose up -d postgres
pytest tests/integration -v

# Все тесты (e2e автоматически скипаются без Playwright,
# integration — без доступного PostgreSQL)
pytest tests -v

# Только OCR парсинг
pytest tests/unit/test_ocr_parsing.py -v

# Полный прогон с контролем покрытия (как в CI)
pytest tests/unit tests/integration -m "not e2e" \
    --cov=src --cov-report=term-missing --cov-fail-under=70

# Тестовая БД на нестандартном хосте/порте (skip_if_set в [tool.pytest_env]):
ET_DATABASE_URL="postgresql+asyncpg://electro:electro_secret@localhost:5433/electro_treasur_test" \
    pytest tests/integration -v
```

---

## 🏗️ Архитектура

```
tests/
├── conftest.py                  # Core fixtures (engine, session, client, auth)
├── factories/
│   ├── users.py                 # factory-boy: UserFactory (dict + Argon2 hash)
│   └── transactions.py          # factory-boy: TransactionCreateFactory, CategoryFactory
├── unit/                        # 205 тестов — без БД, без I/O
│   ├── test_ocr_parsing.py      #  81 — Распознавание чеков/выписок (Tesseract)
│   ├── test_telegram_helpers.py #  37 — Telegram handler pure functions
│   ├── test_auth_service.py     #  21 — JWT + Argon2 хэширование
│   ├── test_schemas.py          #  19 — Pydantic V2 валидация
│   ├── test_import_helpers.py   #  17 — CSV/Excel column aliasing + парсинг
│   ├── test_analytics.py        #  11 — Savings Simulator (compound interest)
│   ├── test_budget_math.py      #   7 — Budget aggregation math
│   ├── test_cashflow_prep.py    #   7 — previous_month_range + LLM prompt builder (pure)
│   └── test_services.py         #   5 — Dashboard aggregation + fake repo
├── integration/                 # 80 тестов — требует PostgreSQL
│   ├── conftest.py              # Auto-skip guard (PG offline → skip)
│   ├── test_api_full.py         #  31 — Full CRUD API (HTTP→Route→Service→DB)
│   ├── test_user_service.py     #  15 — User CRUD + category cascade
│   ├── test_import_export.py    #  11 — CSV import/export roundtrip
│   ├── test_repositories.py     #  10 — ORM constraints (UNIQUE, CASCADE, NUMERIC)
│   ├── test_api.py              #   5 — Legacy transaction API tests (POST only)
│   ├── test_cashflow_prep.py    #   4 — Monthly insight pipeline (get_active_user_ids, upsert, arq fan-out)
│   └── test_offers.py           #   4 — Bank offers API + latest-insight endpoint (new feature, in progress)
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

**Результат** (замер 2026-07-04): `205 passed, 81 skipped` (PG offline; 80 integration +
1 skip модуля e2e без Playwright) vs `285 passed, 1 skipped` (PG online — весь набор
unit+integration зелёный после фиксов auth и ORM-каскадов; 1 skip — модуль e2e без Playwright)

---

## 📋 Детальное описание тестов

### Unit Tests (205)

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

#### `test_cashflow_prep.py` (unit) — 7 тестов

Чистые хелперы месячного LLM-инсайта (`src/services/cashflow_prep.py`), без БД:

| Тестов | Что проверяет |
|---|---|
| 6 | `previous_month_range`: середина месяца, переход через год (январь→декабрь), невисокосный/високосный февраль, последний день месяца |
| 1 | `build_insight_prompt`: промпт содержит период и суммы в правильном формате |

---

### Integration Tests (80)

#### `test_api_full.py` — 31 тест

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

#### `test_cashflow_prep.py` (integration) — 4 теста

Месячный LLM-инсайт пайплайн (`src/infrastructure/workers/llm_worker.py` + `cashflow_prep.py`)
против реального PostgreSQL, с фейковым arq-пулом:

| Тестов | Что проверяет |
|---|---|
| 1 | `get_active_user_ids` фильтрует пользователей строго по периоду (не по соседним месяцам) |
| 1 | `upsert_insight` идемпотентен — повторный запуск обновляет строку, а не дублирует |
| 1 | `generate_llm_insight` персистит строку `insights` с ожидаемыми полями |
| 1 | `schedule_monthly_analysis` делает fan-out: enqueue_job вызывается по разу на активного пользователя |

---

#### `test_offers.py` — 4 теста

Bank Offers API (CPA-монетизация Savings Navigator) + `GET /v1/insights/latest` — новая,
незакоммиченная фича (см. `git status`):

| Тестов | Что проверяет |
|---|---|
| 1 | `GET /v1/offers/` возвращает только активные офферы, отсортированные по `sort_order` |
| 1 | `POST /v1/offers/{id}/click` атомарно инкрементирует счётчик кликов |
| 1 | Клик по несуществующему офферу → `404` |
| 1 | `GET /v1/insights/latest`: `null` при отсутствии инсайтов, затем — самый свежий по `period_end` |

---

### E2E Tests (2)

| Тест | Что проверяет |
|---|---|
| `test_successful_login_redirects_to_dashboard` | Логин через браузер + редирект на дашборд («Общее состояние») |
| `test_invalid_credentials_show_error` | Неверные креды → сообщение об ошибке, редиректа нет |

> **Требования:** `pip install playwright && playwright install chromium`,
> запущенные frontend (`localhost:5173`) и backend (`localhost:8000`).
> Без установленного Playwright модуль скипается целиком (`pytest.importorskip`)
> и не ломает коллекцию остальных тестов.

---

## 🔬 Технологии и паттерны

| Технология | Применение |
|---|---|
| **pytest** | Core test runner (маркер `e2e` зарегистрирован в `pyproject.toml`) |
| **pytest-asyncio** | Async-тесты без декораторов (`asyncio_mode = "auto"`); event loop на каждый тест — поэтому test_engine использует `NullPool` |
| **pytest-env** | Тестовое окружение из `[tool.pytest_env]` (ET_DATABASE_URL с `skip_if_set` — можно переопределить извне, ET_SECRET_KEY, ET_REDIS_URL) |
| **hypothesis** | Property-based testing (`test_ocr_parsing.py` — фаззинг парсера) |
| **factory-boy** | Фабрики данных (`tests/factories/` — dict-фабрики, `FuzzyDecimal` с float-границами) |
| **httpx ASGITransport** | `AsyncClient` напрямую к FastAPI app in-process, без сети (`tests/conftest.py::async_client`) |
| **Playwright + storageState** | E2E: логин через API один раз за сессию, JWT инжектится в localStorage и переиспользуется через `storage_state` (`tests/e2e/conftest.py`) |
| **SAVEPOINT-изоляция** | `db_session` = `begin_nested()` внутри некоммитящейся транзакции соединения; откат за O(1) после каждого теста |

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

| Метрика | Значение (замер 2026-07-04) |
|---|---|
| Unit-тесты (205) | **~4.5 секунды** |
| Integration (80) | **~10 секунд** (с PG) |
| Полный прогон (285, с PG) | **~15 секунд** |
| Полный прогон + coverage | **~23 секунды** |
| Очистка per-test | **O(1)** (ROLLBACK, не DROP) |

---

## 🛡️ Безопасность тестов

1. **Production DB Guard** — `assert database_url.endswith("_test")` предотвращает запуск тестов на проде
2. **Auto-skip** — отсутствие PG не ломает CI для unit-тестов
3. **Fake Redis** — `AsyncMock` заменяет Redis без внешних зависимостей
4. **Hermetic isolation** — SAVEPOINT гарантирует чистую БД каждому тесту

---

## 🔄 Изменения фреймворка (2026-07-04)

Исправлены дефекты, из-за которых фреймворк был частично неработоспособен локально:

| Изменение | Файл | Почему |
|---|---|---|
| **Фикс краша коллекции e2e** — `pytest.importorskip("playwright")` в начале модуля | `tests/e2e/test_user_journey.py` | Импорт `playwright.async_api` на уровне модуля ронял ВСЮ коллекцию (`Interrupted: 1 error during collection`) при отсутствии Playwright. Хук в `e2e/conftest.py` срабатывает после импорта модуля и не спасал. Теперь модуль корректно скипается. |
| **Убраны cov-флаги из `addopts`** | `pyproject.toml` | `--cov-fail-under=70` в `addopts` ронял ЛЮБОЕ подмножество (`pytest tests/unit` давал ~18% < 70). CI передаёт все cov-флаги явно (см. ниже), поэтому контроль покрытия не потерян. |
| **`NullPool` для `test_engine`** | `tests/conftest.py` | pytest-asyncio создаёт новый event loop на каждый тест, а соединения asyncpg привязаны к loop. QueuePool (`pool_size=5`) переиспользовал соединение из чужого loop → массовые `RuntimeError: ... attached to a different loop` (41 error в integration-прогоне). |
| **`FuzzyDecimal` с float-границами** | `tests/factories/users.py`, `tests/factories/transactions.py` | `FuzzyDecimal(low=Decimal(...))` падал с `TypeError` внутри `random.uniform()` — границы должны быть float. |
| **Фикс контракта 422 в тесте** | `tests/integration/test_api.py` | Тест ожидал дефолтный формат FastAPI (`detail` = список), а кастомный handler (`src/core/exceptions.py`) кладёт список ошибок в ключ `errors`. |
| **`skip_if_set` для `ET_DATABASE_URL`** | `pyproject.toml` | Позволяет локально указать другой хост/порт тестовой БД через переменную окружения. Значение по умолчанию не изменилось. |
| **`filterwarnings` для pytesseract** | `pyproject.toml` | Сторонний `DeprecationWarning` (`pkgutil.find_loader`) засорял вывод. Предупреждения из собственного кода `src/` НЕ подавляются. |

### Исправленные дефекты `src/`

| Дата | Дефект | Фикс |
|---|---|---|
| 2026-07-04 | `src/api/v1/auth.py` — dummy-хэш для timing-attack защиты был в формате **bcrypt** (`$2b$12$...`), а `verify_password` использует **argon2** → `InvalidHashError` → **HTTP 500 вместо 401** на логине с несуществующим email. | Dummy-хэш вынесен в `auth_service.DUMMY_PASSWORD_HASH` — валидный Argon2-хэш, вычисляемый через `ph.hash(...)`. Argon2-проверка реально выполняется (защита от timing attack сохранена), `verify_password` возвращает `False`. Тест `TestAuthFlow::test_login_nonexistent_user_401` зелёный. |
| 2026-07-04 | `src/domain/models.py` — FK в БД с `ondelete="CASCADE"`, но ORM-relationships без `passive_deletes=True` → `session.delete(user/category)` пытался `UPDATE ... SET user_id=NULL` по NOT NULL FK → `NotNullViolationError`. | `passive_deletes=True` добавлен к коллекциям с NOT NULL детьми (`User.categories/budgets/transactions`, `Category.budgets/transactions`) — ORM доверяет каскад БД. Схема БД не менялась (миграция не нужна). `TestCascadeDeletes` (2 теста) зелёные. |

> Примечание: `Category.subcategories` намеренно оставлен без `passive_deletes` — `parent_id`
> nullable, `NotNullViolationError` не возникает; правка сменила бы семантику (orphan vs delete)
> без покрытия тестом. Здесь БД-уровневый CASCADE и ORM-поведение расходятся — потенциальная
> отдельная задача.

---

## 📈 CI/CD интеграция

Реальный пайплайн — `.github/workflows/ci.yml`, один job `test` (запускается после `lint`):

| Шаг | Что делает |
|---|---|
| **service `postgres`** | `postgres:16-alpine` с healthcheck `pg_isready`; user `electro`, база `electro_treasur_test`, порт 5432 |
| **env** | `ET_DATABASE_URL`, `ET_SECRET_KEY`, `ET_REDIS_URL`, `ET_TELEGRAM_BOT_TOKEN` задаются явно на уровне job |
| **Системные зависимости** | `tesseract-ocr` + `tesseract-ocr-rus` (для OCR-тестов) |
| **Прогон** | `pytest tests/unit tests/integration -v --tb=short -m "not e2e" --junitxml=test-results.xml --cov=src --cov-report=term-missing --cov-report=xml:coverage.xml --cov-fail-under=70` |
| **Артефакты** | `test-results.xml` + `coverage.xml` загружаются даже при фейле (30 дней) |

Ключевое: **все cov-флаги CI передаёт явно** — именно поэтому их можно было безопасно
убрать из локальных `addopts`. E2E в CI не запускаются (`-m "not e2e"`).

---

## 📦 Зависимости (test-only)

```
pytest>=8.3
pytest-asyncio>=0.25
pytest-cov>=6.0
pytest-env>=1.1
hypothesis>=6.100
factory-boy>=3.3
httpx>=0.28
playwright  # только для E2E (опционально — без него e2e скипаются)
```
