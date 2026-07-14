# Citrine Vault — учебный конспект владельца проекта

> Цель документа: понять собственный фреймворк «от запроса до пикселя», уметь рассказывать
> о нём на собеседованиях и иметь под рукой смоук-чеклист тестировщика.
> Все примеры кода — реальные, с путями к файлам репозитория.

---

## ЧАСТЬ 1. Как устроен наш фреймворк

### 1.1. Docker-стек: кто в нём живёт

Основной файл — `docker-compose.yml` (+ `docker-compose.override.yml` подхватывается локально
автоматически, `docker-compose.prod.yml` — только явным `-f` на проде,
`docker-compose.monitoring.yml` — отдельный оверлей мониторинга).

| Сервис | Образ / команда | Роль |
|---|---|---|
| `postgres` | `postgres:16-alpine` | Единственное хранилище данных, healthcheck `pg_isready` |
| `pgbouncer` | `edoburu/pgbouncer` | Пул соединений: `POOL_MODE: transaction`, `DEFAULT_POOL_SIZE: 200`, `MAX_CLIENT_CONN: 10000`, auth `scram-sha-256` |
| `redis` | `redis:7-alpine` | Кэш, idempotency-ключи, refresh-токены, очередь arq; `--appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru` |
| `backend` | `backend/Dockerfile`, `uvicorn src.main:app --workers 4` | FastAPI API на :8000, HTTP-healthcheck `/health` |
| `frontend` | `frontend/Dockerfile` (nginx + статика Vite) | **Единственный сервис с открытыми портами 80/443** — reverse proxy для всего стека |
| `telegram-bot` | `python -m src.infrastructure.telegram.bot` | Aiogram 3, ждёт pgbouncer + redis + healthy backend; healthcheck отключён (нет HTTP) |
| `arq-worker` | `python run_arq.py` | Фоновые задачи и cron (инсайты, импорт выписок, напоминания) |
| `mailhog` | только в `docker-compose.override.yml` | Локальная отладка почты (web UI :8025); в проде письма идут в лог |
| `prometheus`, `grafana`, `alertmanager`, `cadvisor`, exporters | `docker-compose.monitoring.yml` | Метрики/алерты; Grafana :3000, Prometheus :9090, Alertmanager :9093 |

Ключевая идея безопасности периметра: наружу торчит только nginx (80/443); postgres, redis,
backend доступны лишь по внутренней docker-сети.

### 1.2. Путь запроса: браузер → пиксель

```
Браузер ──HTTPS──▶ nginx (контейнер frontend, :80/:443)
   │  статика: /assets/* → кэш «навсегда» (Vite-хэши в именах)
   │  SPA-фоллбек: try_files $uri /index.html
   └─ /api/* ──▶ proxy_pass http://backend:8000/   ← префикс /api ОТРЕЗАЕТСЯ
                    │
                    ▼
              FastAPI (uvicorn, 4 воркера)
                    │  Depends(get_session) → AsyncSession
                    ▼
              SQLAlchemy 2.0 async (asyncpg)
                    │  DSN указывает на pgbouncer:6432
                    ▼
              PgBouncer (transaction mode) ──▶ PostgreSQL 16
```

Конфиг прокси — `frontend/nginx.conf`:

```nginx
# frontend/nginx.conf
client_max_body_size 10m;          # импорт выписок; без этого 413 на 1 МБ
location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
location / { try_files $uri $uri/ /index.html; }        # SPA-роутинг
location /api/ { proxy_pass http://backend:8000/; }     # слэш в конце = срез /api
```

Поэтому фронтовый клиент ходит на `/api/v1/...` (`API_BASE = '/api'` в
`frontend/src/api/client.ts`), а бэкенд роуты живут без префикса `/api` — его снимает nginx.

### 1.3. Backend: FastAPI + SQLAlchemy 2.0 async

#### Доменные модели (`backend/src/domain/models.py`)

Архитектурные инварианты прописаны прямо в докстринге модуля:

```python
# backend/src/domain/models.py
"""
  • NUMERIC(12,2) for ALL monetary columns — no IEEE-754 float drift.
  • idempotency_key on Transaction is UNIQUE — DB-level guard against double-writes.
  • executed_at uses TIMESTAMPTZ — timezone-aware by design.
"""
amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
idempotency_key: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=False), unique=True)
```

Почему так:

- **NUMERIC вместо float** — деньги нельзя хранить в IEEE-754: `0.1 + 0.2 != 0.3`.
  NUMERIC(12,2) — точная десятичная арифметика; в Python маппится в `Decimal`.
- **idempotency_key UNIQUE** — последний рубеж защиты от двойного списания: даже если два
  одинаковых запроса проскочат Redis-проверку, второй INSERT упадёт по constraint.
- **TIMESTAMPTZ** — время всегда с зоной; сервер БД в UTC, отображение (МСК) — забота клиента.
- **`lazy="raise_on_sql"`** на коллекциях `User` — защита от случайного N+1: раньше стоял
  `selectin`, и `get_user_by_email` (каждый авторизованный запрос!) тянул всю историю
  транзакций. Теперь ленивый доступ падает с явной ошибкой, а нужное грузится `selectinload()`.
- **`passive_deletes=True`** — каскад доверен БД (`ON DELETE CASCADE`), иначе ORM пытался
  `UPDATE ... SET user_id=NULL` по NOT NULL FK.
- Бонус: `TaxRule.tsv` — генерируемая колонка `TSVECTOR` (`Computed(...)`, persisted) с весами
  A/B и GIN-индексом — полнотекстовый поиск по-русски без LLM.

#### Pydantic V2 схемы (`backend/src/schemas/`)

Отдельный слой сериализации: `transaction.py`, `dashboard.py`, `goal.py`, `insight.py` и т.д.
Строгая валидация: суммы принимаются строками (`amount: payload.amount.toString()` на фронте),
`model_validate(tx)` через `from_attributes`, частичные апдейты — `model_dump(exclude_unset=True)`.

#### Alembic (`backend/migrations/versions/` — 18 миграций)

Каждая миграция — пара `upgrade()/downgrade()` с явной цепочкой `revision → down_revision`:

```python
# backend/migrations/versions/b9c0d1e2f3a4_add_notifications_table.py
revision: str = 'b9c0d1e2f3a4'
down_revision: str | None = '7848b98b914b'

def upgrade() -> None:
    op.create_table('notifications', ...,
        sa.UniqueConstraint('user_id', 'dedup_key', name='uq_notifications_user_dedup'))
```

Применение на проде: `docker-compose exec backend alembic upgrade head`.

#### arq-воркеры (`backend/src/infrastructure/workers/`)

Точка входа — `backend/run_arq.py` (обход бага arq ≤ 0.27 на Python 3.14: Worker создаётся
внутри `asyncio.run()`, чтобы `get_event_loop()` нашёл живой loop). Конфигурация —
`insight_scheduler.WorkerSettings`:

```python
# backend/src/infrastructure/workers/insight_scheduler.py
functions = [generate_period_insight, calculate_static_insights,
             parse_statement, remind_inactive_users, push_free_funds]
cron_jobs = [
    cron(schedule_monthly_analysis, day=1, hour=3, minute=0),      # месячный фан-аут инсайтов
    cron(schedule_weekly_push, weekday=6, hour=18, minute=0),       # вс 21:00 МСК — Telegram-пуш
    cron(remind_inactive_users, hour={10, 19}, minute=0),           # 13:00 и 22:00 МСК — «умный пинг»
    cron(push_free_funds, weekday=0, hour=6, minute=0),             # пн 09:00 МСК — свободные средства
]
```

Паттерн «fan-out»: cron-задача одна, но она ставит по одной джобе на каждого активного
пользователя (`pool.enqueue_job("calculate_static_insights", user_id, ...)`) — параллелизм и
изоляция ошибок по юзерам. Результат пишется идемпотентным upsert'ом
(`cashflow_prep.upsert_insight`, см. 3.3). Статус долгих джоб фронт получает через SSE:
`GET /v1/jobs/{task_id}/stream` (`backend/src/api/v1/jobs.py`, `StreamingResponse`,
`text/event-stream`) — сервер сам опрашивает arq, клиент не поллит.

#### Аутентификация (`backend/src/services/auth_service.py`, `src/api/v1/auth.py`, `src/dependencies.py`)

Схема «короткий JWT + отзываемый refresh»:

1. **Login** → backend ставит два httpOnly-cookie (`set_cookie(..., httponly=True,
   secure=settings.cookie_secure, samesite="lax")`): access (JWT, 15 минут) и refresh.
2. **Access-токен** — JWT (`python-jose`), `sub` = email, живёт `ACCESS_TOKEN_EXPIRE_MINUTES = 15`.
3. **Refresh-токен** — НЕ JWT, а непрозрачная строка `"{user_id}:{token_id}"`; сам `token_id`
   (UUID4) лежит только в Redis с TTL. Поэтому его можно отозвать мгновенно (logout/rotation).
4. **Rotation**: `refresh_access_token()` валидирует старый токен, удаляет его из Redis ДО
   выпуска нового — повторное использование украденного refresh вернёт ошибку.
5. **Пароли** — Argon2id, причём хэширование/проверка уходят в thread pool
   (`loop.run_in_executor`), чтобы CPU-bound Argon2 не блокировал event loop.
6. **Timing-attack защита**: для несуществующего email проверяется `DUMMY_PASSWORD_HASH`
   (валидный Argon2-хэш) — время ответа не выдаёт существование пользователя.
7. `get_current_user` (`src/dependencies.py`) читает cookie `access_token`, декодит JWT и
   грузит юзера из БД; `require_consultant` — RBAC-гейт, роль проверяется по БД, а не по
   JWT-клейму (смена роли действует сразу).

#### Пул соединений: почему настройки именно такие (`backend/src/database.py`)

```python
# backend/src/database.py
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,                          # ловим протухшие соединения за bouncer'ом
    connect_args={"statement_cache_size": 0},    # ОБЯЗАТЕЛЬНО под transaction-pooling
)
```

`statement_cache_size=0` — критично: asyncpg кэширует prepared statements, привязанные к
конкретному бэкенд-соединению Postgres, а PgBouncer в transaction-режиме раздаёт разные
соединения между транзакциями → без этого ловим плавающие
`prepared statement "__asyncpg_stmt__" does not exist`.

### 1.4. Frontend: React 19 + Vite + TanStack Query

Стек по `frontend/package.json`: `react ^19.2.4`, `@tanstack/react-query ^5.91`,
`framer-motion ^12`, `vite ^8`, `tailwindcss ^3.4`, `recharts ^3.8`.

**Роутинг** (`frontend/src/App.tsx`): react-router, публичные `/login`, `/register`;
защищённый layout (`ProtectedRoute` + `Sidebar`) с страницами `/` (Обзор), `/transactions`,
`/budgets`, `/analytics`, `/savings-navigator` (Финплан), `/games`, `/settings/profile`,
`/consultant` (только роль consultant).

**API-клиент** (`frontend/src/api/client.ts`) — типизированные fetch-обёртки, ноль `any`:

```typescript
// frontend/src/api/client.ts — единственный in-flight refresh
let refreshPromise: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then((res) => res.ok).catch(() => false)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
```

На 401 клиент один раз делает refresh и повторяет запрос; параллельные 401 не плодят
рефреши (общий промис); фейл → редирект на `/login`. Токены недоступны из JS вообще —
`credentials: 'include'` + httpOnly cookie.

**TanStack Query** — весь серверный стейт:

- Кеш-ключи включают параметры: `queryKey: ['dashboard', start, end]`
  (`BudgetEnvelopes.tsx`) — смена месяца = другой ключ = отдельный кеш.
- Инвалидация после мутаций: `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`
  (префиксная — инвалидирует все периоды), `['goals']` после взноса в цель.
- Фоновый поллинг: `refetchInterval: 60_000` у колокольчика
  (`frontend/src/components/layout/NotificationBell.tsx`).
- `staleTime: 60_000` у списка целей в Piggybank — не дёргать API чаще раза в минуту.

**UI-язык**: Tailwind glassmorphism (`bg-white/40 backdrop-blur-3xl border-white/10
rounded-[2.5rem]`), framer-motion для входных анимаций, спринг-счётчиков
(`useMotionValue → useSpring → useTransform`) и конфетти без сторонних пакетов.

**Структура `frontend/src/components/`**: `dashboard/` (17 компонентов: конверты, матрица,
QuickEntry, SafeToSpend, импорт выписок…), `analytics/`, `budgets/`, `games/`, `insights/`,
`layout/` (Sidebar, NotificationBell, FeedbackWidget), `tax/`, `auth/`, `profile/`,
`consultant/`, `ui/`.

### 1.5. Тестовый фреймворк (`backend/tests/`)

Полная карта — `backend/tests/TESTING.md`: **287 тестов** (205 unit + 80 integration + 2 e2e),
замер покрытия 67% при пороге CI 70% (порог сейчас не достигается — дыра в
`src/infrastructure/telegram/*`).

**Главная инновация — Nested Savepoint Isolation** (`backend/tests/conftest.py`): одно
соединение с некоммитящейся транзакцией на всю сессию, каждый тест — в своём SAVEPOINT:

```python
# backend/tests/conftest.py
@pytest_asyncio.fixture
async def db_session(db_connection: AsyncConnection) -> AsyncGenerator[AsyncSession, None]:
    async with testing_session_factory() as session:
        nested = await session.begin_nested()   # SAVEPOINT
        try:
            yield session
        finally:
            if nested.is_active:
                await nested.rollback()          # база снова чистая за O(1)
```

Тест может звать `session.commit()` — закоммитится только SAVEPOINT, наружу ничего не утечёт.
Очистка — ROLLBACK вместо DROP/CREATE, реальный PostgreSQL (не SQLite), Testcontainers
намеренно НЕ используются (`backend/src/agents/docs/qa_rules.md`).

Ключевые фикстуры:

| Фикстура | Что даёт |
|---|---|
| `db_session` | AsyncSession внутри SAVEPOINT |
| `async_client` | `httpx.AsyncClient` через `ASGITransport` прямо к FastAPI app (без сети) + DI-override БД и фейковый Redis (`AsyncMock`) |
| `test_user` | Юзер `vault-tester@citrine.dev` с Argon2-хэшем |
| `auth_headers` | `{"Cookie": f"access_token={jwt}"}` — auth переехал на cookie, интерфейс фикстуры сохранён |

Защиты: guard `assert settings.database_url.endswith("_test")` (тесты физически не запустятся
на проде), auto-skip integration при недоступном PG (`tests/integration/conftest.py`),
`NullPool` в test_engine (pytest-asyncio даёт новый event loop на тест — QueuePool ловил
`Future attached to a different loop`), autouse-отключение rate-limiter'а.

Unit vs integration: чистая логика (OCR-парсинг — 81 тест, budget math, JWT) — unit без БД,
с Hypothesis для широких пространств входов; эндпоинты/constraint'ы/каскады — integration
через `async_client` + `db_session`; e2e — Playwright c переиспользованием `storage_state`.

CI (`.github/workflows/ci.yml`): lint (ruff, mypy, pip-audit) → frontend (tsc, vite build) →
test (сервис postgres:16-alpine, tesseract, `pytest -m "not e2e" --cov=src --cov-fail-under=70`,
cov-флаги передаются ЯВНО — из локальных addopts они убраны) → docker build → GHCR.

---

## ЧАСТЬ 2. Как работают фичи бюджетов

Все три фичи живут в одном файле `frontend/src/components/dashboard/BudgetEnvelopes.tsx` и
питаются ОДНИМ запросом `fetchDashboard(start, end)` → `GET /api/v1/dashboard/` →
`backend/src/services/dashboard_service.py::get_monthly_dashboard`. Бэкенд возвращает `rows`:
по строке на категорию с `planned` (сумма лимитов `budgets` за месяц) и `fact` (сумма
транзакций за период, single-pass O(N)-агрегация). Фронт фильтрует конверты как
`rows.filter(r => parseFloat(r.planned) > 0)`.

Период запроса — строго московский месяц: `getMoscowDate()`
(`frontend/src/lib/dateUtils.ts`) конвертирует системное время в МСК через
`toLocaleString("en-US", { timeZone: "Europe/Moscow" })`, оттуда берутся первый/последний день
месяца, и они же входят в кеш-ключ `['dashboard', start, end]`.

### 2.1. Индекс дисциплины бюджета (компонент `BudgetDiscipline`)

```typescript
// frontend/src/components/dashboard/BudgetEnvelopes.tsx
const total = rows.length;
const onTrack = rows.filter((r) => parseFloat(r.fact) <= parseFloat(r.planned)).length;
const overspent = rows.reduce((s, r) => s + Math.max(parseFloat(r.fact) - parseFloat(r.planned), 0), 0);
const score = total ? Math.round((onTrack / total) * 100) : 0;
```

- **Формула**: доля конвертов «в норме» (`fact ≤ planned`) от общего числа конвертов × 100.
  Ноль конвертов → 0. Отдельно суммируется перерасход по «пробитым» конвертам.
- **Тиры-звания**: ≥90 — «Мастер бюджета» 🏆, ≥70 — «Под контролем» ✨, ≥40 — «В балансе» ⚖️,
  иначе «Зона риска» 🔥. Цвет бара: ≥70 зелёный `#10B981`, ≥40 оранжевый `#FF7A00`, ниже —
  розовый `#F43F5E`.
- **Данные**: считается из уже загруженных строк дашборда, ни одного дополнительного запроса.

### 2.2. Копилка / Сейф (компонент `Piggybank`)

```typescript
// frontend/src/components/dashboard/BudgetEnvelopes.tsx
const savedInt = Math.round(
  rows.reduce((s, r) => s + Math.max(parseFloat(r.planned) - parseFloat(r.fact), 0), 0),
);
```

- **Формула**: `saved = Σ max(planned − fact, 0)` — экономия только по конвертам «в плюс»,
  перерасход других конвертов её НЕ уменьшает. При `saved ≤ 0` блок не рендерится.
- **Связь с целями**: селект активных целей (`fetchGoals`, фильтр `progress_pct < 100`) +
  кнопка «Отложить в цель» → `PATCH /v1/goals/{id}/contribute` с суммой строкой
  (`contributeGoal(id, String(savedInt))`). На бэке (`backend/src/api/v1/goals.py`) просто
  `goal.current_amount += body.amount`, прогресс = `current/target`, capped 100.
- **Защита от повторного переноса**: локальный флаг `allocated` — после успешного взноса
  кнопка становится «Отложено ✓» и дизейблится, т.к. `saved` не убывает после взноса и без
  флага сумму можно было бы задублировать. Успех → `invalidateQueries(['goals'])` + toast.
- Число анимируется спрингом (`useMotionValue`/`useSpring`), без rerender-циклов.

### 2.3. Конверты

Каждый конверт — карточка с «заливкой» снизу высотой `min(100, max(3, fact/planned*100))%`.

- **Burn rate по МСК**: конверт получает бейдж «Burn Rate», если процент расхода обгоняет
  процент прошедшего месяца больше чем на 10 п.п.:

```typescript
const currentMsk = getMoscowDate();
const percentTimeElapsed = (todayDate / daysInMonth) * 100;
const isBurnWarning = percent > (percentTimeElapsed + 10) && !isOver;
```

- **Guilt-free категории**: определяются подстрокой в имени категории
  (`'отдых' | 'развлечения' | 'leisure' | 'бары' | 'кафе' | 'лайфстайл'`) — такие конверты
  всегда красятся золотым (`#C5A059`), без «тревожных» цветов: тратить на отдых — нормально.
- **Цветовая логика заливки**: guilt-free → золото; `fact > planned` → роза (rose-500) +
  розовая рамка; `percent > 75` → оранжевый warning; иначе — изумруд. Конверт, закрытый
  «в плюс» (`fact < planned`), получает `ConfettiBurst` — 10 детерминированных частиц
  (без `Math.random`, чистый рендер).
- CRUD: карандаш/корзина на hover → `BudgetConfigModal` (PUT `/v1/budgets/` upsert) и
  `DELETE /v1/budgets/{categoryId}?month&year` с инвалидацией `['dashboard']`. Пустое
  состояние — ghost-карточка «Создать Бюджет».

### 2.4. Что улучшить (рекомендации)

1. **Флаг `allocated` живёт только в состоянии компонента** — перезагрузка страницы (или
   уход/возврат на вкладку) сбрасывает его, и ту же «экономию» можно отложить в цель
   повторно. Правильно — идемпотентность на бэке: passing `Idempotency-Key`
   (паттерн уже есть в `transaction_service.py`) или таблица «перенос месяца N выполнен».
2. **Индекс дисциплины не учитывает время месяца**: 1-го числа все конверты тривиально
   «в норме» и индекс = 100. Честнее сравнивать `fact` с pro-rata планом
   (`planned × dayOfMonth/daysInMonth`) — логика burn rate уже написана рядом, но в индексе
   не используется.
3. **Копилка считает «сэкономленным» незакрытый месяц**: в середине месяца
   `planned − fact` — это ещё не экономия, а неистраченный остаток. Стоит либо показывать
   копилку только за завершённый месяц, либо явно писать «прогноз экономии» и откладывать
   `min(saved, planned − fact на конец месяца)`.
4. **Фильтр конвертов `planned > 0` не проверяет `type === 'expense'`**: строка дашборда
   с типом income и заданным планом попадёт в конверты и в формулы (для income «fact ≤
   planned» означает ровно обратное). Добавить `r.type === 'expense'` в фильтр.
5. **Guilt-free по подстрокам имени — хрупко**: «Кафедра», переименованные категории и
   англоязычные названия ломают логику. Лучше флаг `is_guilt_free` на модели `Category`
   (миграция + чекбокс в `CategoryManagerModal`).
6. **UX: `deleteBudget` без подтверждения** — корзина на карточке сразу удаляет конверт
   (в проекте уже есть `ConfirmDeleteDialog.tsx` — переиспользовать); плюс у мутации взноса
   нет оптимистичного обновления списка целей.

---

## ЧАСТЬ 3. Подготовка к собеседованиям: вопросы-ответы по СВОЕМУ проекту

**Q1. Почему деньги — NUMERIC/Decimal, а не float?**
Float — двоичная IEEE-754 дробь: 0.1 не представим точно, суммирование тысяч транзакций
накапливает дрейф, а сравнения `==` становятся лотереей. NUMERIC(12,2) в Postgres — точная
десятичная арифметика, SQLAlchemy маппит её в `Decimal`. По этой же причине фронт передаёт
суммы строками (`amount.toString()` в `client.ts`) — JSON-число превратилось бы во float.
Где смотреть: `backend/src/domain/models.py` (все `Numeric(12, 2)`).

**Q2. Как устроена идемпотентность создания транзакции?**
Двухуровневая защита: сначала O(1) проверка Redis-ключа `idempotency:{key}` — на хит
возвращается закэшированный ответ без похода в БД; на промах — INSERT с `idempotency_key`,
где UNIQUE-constraint БД добивает гонку, если два запроса проскочили Redis одновременно.
После успеха ключ пишется в Redis с TTL 24 ч. Клиент передаёт заголовок `Idempotency-Key`.
Где смотреть: `backend/src/services/transaction_service.py`, constraint
`uq_transaction_idempotency` в `models.py`.

**Q3. А идемпотентность на уровне SQL — есть примеры?**
Да, два разных приёма. `upsert_insight` — `INSERT ... ON CONFLICT (uq_insight_user_period)
DO UPDATE`: повторный расчёт месяца перезаписывает строку, а не дублирует
(`backend/src/services/cashflow_prep.py`). Уведомления «Что нового» — `ON CONFLICT DO
NOTHING` по `(user_id, dedup_key)`: досеивание changelog'а каждому юзеру ровно один раз
(`backend/src/api/v1/notifications.py`). Третий пример — рекорды игр:
`on_conflict_do_update` по `(user_id, game)` в `backend/src/api/v1/games.py`.

**Q4. Зачем в стеке PgBouncer и в каком он режиме?**
Uvicorn с 4 воркерами + бот + arq-воркер — каждый со своим пулом; без bouncer'а Postgres
держал бы сотни тяжёлых backend-процессов. PgBouncer в transaction-режиме мультиплексирует
до 10000 клиентских коннектов в 200 серверных: соединение выдаётся только на время
транзакции. Плата — нельзя полагаться на session-state.
Где смотреть: `docker-compose.yml` (`POOL_MODE: transaction`), `backend/src/database.py`.

**Q5. Какие грабли asyncpg под transaction-pooling вы ловили?**
`prepared statement "__asyncpg_stmt__" does not exist`: asyncpg кэширует prepared statements
на конкретном соединении Postgres, а bouncer между транзакциями подсовывает другое. Лечится
`connect_args={"statement_cache_size": 0}` + `pool_pre_ping=True` для протухших соединений.
Это плавающая ошибка — воспроизводится только под нагрузкой, поэтому важно знать заранее.
Где смотреть: `backend/src/database.py` (комментарий прямо в коде).

**Q6. Как устроена JWT-аутентификация и почему refresh — не JWT?**
Access — короткий JWT (15 мин) в httpOnly-cookie; refresh — непрозрачная строка
`"{user_id}:{uuid4}"`, где секрет лежит только в Redis с TTL. JWT нельзя отозвать до
истечения, а Redis-токен — можно мгновенно (logout, rotation). Refresh одноразовый: при
обновлении старый удаляется из Redis ДО выпуска нового, так что украденный токен после
первого использования мёртв. Где смотреть: `backend/src/services/auth_service.py`.

**Q7. Почему httpOnly-cookie, а не localStorage для токенов?**
localStorage читается любым JS — одна XSS-инъекция, и токен утёк. httpOnly-cookie недоступна
из JavaScript вовсе; браузер сам прикладывает её к запросам (`credentials: 'include'`).
CSRF-риск закрыт `samesite="lax"`. Фронт при этом вообще не знает содержимого токенов —
`login()` возвращает `void`, успех = отсутствие ошибки.
Где смотреть: `backend/src/api/v1/auth.py` (set_cookie), `frontend/src/api/client.ts`.

**Q8. Как фронт переживает истечение access-токена?**
Перехват на уровне `apiFetch`: 401 (кроме самих auth-эндпоинтов) → один POST `/auth/refresh`
→ повтор исходного запроса; неудача → редирект на /login. Ключевая деталь — единый in-flight
`refreshPromise`: десять параллельных 401 ждут один и тот же рефреш, а не устраивают шторм
(и не сжигают одноразовый refresh-токен наперегонки). Где смотреть:
`frontend/src/api/client.ts::refreshSession`.

**Q9. Argon2 — синхронный и CPU-тяжёлый. Как он не блокирует event loop?**
`verify_password`/`get_password_hash` заворачивают вызов в `loop.run_in_executor(None, ...)`
— хэширование уезжает в thread pool, event loop продолжает обслуживать другие запросы.
Плюс timing-attack защита: при неизвестном email всё равно выполняется Argon2-проверка
против заранее посчитанного `DUMMY_PASSWORD_HASH`, чтобы по времени ответа нельзя было
понять, существует ли аккаунт. Где смотреть: `backend/src/services/auth_service.py`.

**Q10. TanStack Query vs useEffect+fetch — что даёт на практике?**
Декларативный серверный стейт: кеш по ключу (`['dashboard', start, end]`), дедупликация
одинаковых запросов из разных компонентов, `staleTime`, фоновая ревалидация,
`refetchInterval` для поллинга (колокольчик — раз в 60 с), и `invalidateQueries` после
мутаций вместо ручной синхронизации стейта. В useEffect-варианте всё это пишется руками и
обрастает гонками (setState после unmount, двойные запросы в StrictMode).
Где смотреть: `frontend/src/components/dashboard/BudgetEnvelopes.tsx`,
`frontend/src/components/layout/NotificationBell.tsx`.

**Q11. Как проектировать кеш-ключи запросов?**
Ключ должен включать все параметры, от которых зависит ответ: `['dashboard', start, end]` —
разные месяцы кешируются раздельно и переключение месяца не показывает чужие данные. А
инвалидация работает по префиксу: `invalidateQueries({ queryKey: ['dashboard'] })` сбрасывает
все периоды сразу — удобно после мутации бюджета, когда неизвестно, какие периоды затронуты.
Где смотреть: `BudgetEnvelopes.tsx` (queryKey и deleteMutation.onSuccess).

**Q12. Что такое оптимистичное обновление и где оно уместно в проекте?**
Мутация сразу правит кеш (`queryClient.setQueryData`), не дожидаясь ответа сервера, а при
ошибке откатывается — UI ощущается мгновенным. В проекте мутации консервативные
(invalidate после ответа) — для финансового приложения это осознанный выбор: показать
неподтверждённое списание опаснее, чем подождать 100 мс. Кандидат на оптимистику —
`markNotificationsRead` (колокольчик): цена ошибки нулевая.
Где смотреть: `NotificationBell.tsx`, `Piggybank` в `BudgetEnvelopes.tsx`.

**Q13. arq vs Celery — почему arq?**
arq — нативно асинхронный: джобы это те же `async def`, что и остальной код, один Redis как
брокер, ноль дополнительной инфраструктуры (без RabbitMQ/beat). Celery старше и богаче
(retries-политики, canvas, мониторинг), но его prefork-модель чужда asyncio-кодовой базе —
пришлось бы городить `asyncio.run` внутри тасок или отдельный кластер. Cron встроен в arq
(`cron_jobs` в WorkerSettings). Где смотреть:
`backend/src/infrastructure/workers/insight_scheduler.py`, `backend/run_arq.py`.

**Q14. Как cron-задача обрабатывает тысячи пользователей — и почему fan-out?**
`schedule_monthly_analysis` сама ничего не считает: выбирает id активных юзеров за прошлый
месяц и ставит по джобе `calculate_static_insights` на каждого. Выгоды: параллелизм
(`max_jobs = 10`), изоляция ошибок (упавший юзер не валит остальных), джобы короткие и
вписываются в `job_timeout = 60`. Результат пишется идемпотентным upsert'ом — повторный
запуск крона безопасен. Где смотреть: `insight_scheduler.py`, `cashflow_prep.py`.

**Q15. Как фронт узнаёт о завершении фоновой джобы без поллинга?**
SSE: `GET /v1/jobs/{task_id}/stream` возвращает `StreamingResponse` с
`media_type="text/event-stream"`; сервер сам опрашивает arq и пушит события, браузер держит
одно соединение через `EventSource`. Против поллинга — меньше запросов и мгновенная реакция;
против WebSocket — однонаправленный поток проще: работает через обычный HTTP/прокси, авто-
reconnect бесплатно. Где смотреть: `backend/src/api/v1/jobs.py`.

**Q16. Alembic: как вы ведёте миграции?**
Линейная цепочка из 18 ревизий (`backend/migrations/versions/`), каждая с `upgrade()` и
честным `downgrade()`; имена constraint'ов задаются явно (`uq_notifications_user_dedup`),
чтобы на них можно было ссылаться в `ON CONFLICT`. Схема меняется ТОЛЬКО миграциями — тесты
при этом строят таблицы из metadata (`Base.metadata.create_all`), что заодно проверяет
синхронность моделей и миграций. Прод: `alembic upgrade head` в контейнере.

**Q17. Расскажите про изоляцию тестов без пересоздания БД.**
Nested Savepoint Isolation: одна некоммитящаяся транзакция соединения на всю сессию pytest,
каждый тест — в своём SAVEPOINT (`session.begin_nested()`), после теста `ROLLBACK TO
SAVEPOINT` за O(1). Код приложения может звать `commit()` — закоммитится только savepoint.
Реальный PostgreSQL (диалектные фичи — JSONB, ON CONFLICT — тестируются честно), никакого
SQLite/Testcontainers. Где смотреть: `backend/tests/conftest.py`, `backend/tests/TESTING.md`.

**Q18. Как тестируются эндпоинты без запуска сервера?**
`httpx.AsyncClient(transport=ASGITransport(app=app))` — запросы идут прямо в ASGI-приложение
in-process, без сети и uvicorn. Через `app.dependency_overrides` подменяются `get_db` (на
savepoint-сессию) и `get_redis_client` (на `AsyncMock`). Аутентификация — фикстура
`auth_headers` подсовывает cookie с настоящим JWT тестового юзера.
Где смотреть: `backend/tests/conftest.py::async_client`.

**Q19. Где уместно property-based тестирование?**
Там, где пространство входов слишком велико для примеров: OCR-парсер чеков гоняется
Hypothesis'ом на произвольных строках с инвариантом «не падает и не возвращает мусор»
(суммы > 0, тип ∈ {income, expense}). Для CRUD-тестов Hypothesis избыточен — там важны
конкретные контракты. Где смотреть: `backend/tests/unit/test_ocr_parsing.py`
(класс TestHypothesisRegexSafety), правило — в `backend/src/agents/docs/qa_rules.md`.

**Q20. Nginx как reverse proxy — что он делает в проекте?**
Отдаёт статику Vite (хэшированные ассеты кешируются на год с `immutable`), SPA-фоллбек
`try_files ... /index.html`, gzip текстовых ассетов, `client_max_body_size 10m` для импорта
выписок и проксирует `/api/` → `backend:8000` со срезанием префикса (слэш в конце
`proxy_pass`). Это единственный контейнер с открытыми портами — весь остальной стек скрыт в
docker-сети. Где смотреть: `frontend/nginx.conf`, `docker-compose.yml`.

**Q21. Docker multi-stage build — зачем?**
Builder-стадия ставит gcc/libpq-dev и собирает зависимости в venv; runtime-стадия — slim
без компиляторов, копируется только `/opt/venv`. Итог ~40% меньше образ и нет build-tools в
проде (меньше поверхность атаки). Плюс non-root `appuser`, HEALTHCHECK через `/health`.
Frontend аналогично: node:20 собирает `dist`, nginx:alpine его раздаёт.
Где смотреть: `backend/Dockerfile`, `frontend/Dockerfile`.

**Q22. Как вы ускорили дашборд на уровне SQL?**
Две вещи. Убрали `func.date(executed_at)` из WHERE — функция над колонкой блокировала индекс
`(user_id, executed_at)` и заставляла сканировать всю историю юзера; теперь sargable-диапазон
`executed_at >= start AND < end+1день` в UTC. И вся агрегация — один GROUP BY запрос + один
проход по строкам в Python: O(N + K) вместо N+1 по категориям.
Где смотреть: `backend/src/services/dashboard_service.py` (комментарий к Step 1).

**Q23. Как боролись с N+1 в ORM?**
Коллекции `User.categories/budgets/transactions` объявлены `lazy="raise_on_sql"`: случайный
ленивый доступ падает с явной ошибкой, а не тихо генерирует SQL. До этого стоял `selectin`,
и авторизация каждого запроса тянула всю историю транзакций юзера. Там, где коллекция нужна
— явный `selectinload()`; в списках — `joinedload(Transaction.category)`.
Где смотреть: `backend/src/domain/models.py` (комментарий у relationships),
`transaction_service.py`.

**Q24. Тесты: что дают guard'ы в conftest?**
`assert settings.database_url.endswith("_test")` на этапе коллекции — физически невозможно
прогнать тесты (с их DROP ALL в конце сессии) на боевой базе. Auto-skip в
`tests/integration/conftest.py` — без PostgreSQL integration-набор пропускается, а не
краснеет, поэтому unit-тесты можно гонять где угодно. Ослаблять guard запрещено правилами
QA-агента (`backend/src/agents/docs/qa_rules.md`).

**Q25. Почему в тестовом движке NullPool?**
pytest-asyncio создаёт новый event loop на каждый тест, а соединения asyncpg привязаны к
loop'у, в котором созданы. QueuePool переиспользовал соединение из «чужого» loop'а → массовые
`RuntimeError: Future attached to a different loop` (41 ошибка в integration-прогоне).
NullPool открывает свежее соединение в текущем loop'е — медленнее, но детерминированно.
Где смотреть: `backend/tests/conftest.py` (комментарий у `test_engine`).

**Q26. Что такое покрытие 70% как gate и как оно устроено в CI?**
CI передаёт `--cov=src --cov-fail-under=70` явно в шаге pytest (из локальных addopts флаги
убраны — иначе любой частичный прогон `pytest tests/unit` ложно фейлился по порогу).
Текущий замер — 67%: основной долг — `src/infrastructure/telegram/*`. Порог — не догма о
качестве, а стоп-кран против деградации; правила запрещают его понижать.
Где смотреть: `backend/tests/TESTING.md`, `.github/workflows/ci.yml`.

**Q27. Как sanitized-таймзоны влияют на «границы месяца»?**
`executed_at` — TIMESTAMPTZ, сервер БД считает `date()` в UTC, а пользователь живёт в МСК:
транзакция в 00:30 МСК = 21:30 вчера по UTC, и её день «уезжает». На фронте месяц строится
от `getMoscowDate()`; на бэке рассинхрон отсекается day-index-гардом (`continue` для
delta_days вне диапазона) — строка не портит соседний бакет. Это классический источник
badge-«у меня транзакция не в том дне». Где смотреть: `dashboard_service.py` Step 4,
`frontend/src/lib/dateUtils.ts`.

**Q28. RBAC консультанта: как устроен доступ к чужим данным?**
Грант — строка `ConsultantAccess(consultant_id, client_id)` с UNIQUE-парой; создаёт её сам
клиент по email консультанта, т.е. консультант не может выдать себе доступ. Гейт
`require_consultant` проверяет роль по БД, а не по JWT-клейму — понижение роли действует
мгновенно, не дожидаясь истечения токена. Доступ строго read-only (только чтение
транзакций клиента). Где смотреть: `backend/src/dependencies.py`,
`backend/src/api/v1/consultant.py`, `models.py::ConsultantAccess`.

**Q29. Как хранить API-ключи для внешних интеграций?**
Как пароли: полный ключ показывается один раз при создании, в БД — только Argon2-хэш.
Открытая часть `prefix` под UNIQUE-индексом даёт O(1) поиск кандидата без перебора всех
хэшей. Отзыв — флаг `is_active`, аудит — `last_used_at`.
Где смотреть: `models.py::ApiKey`, `backend/src/services/api_key_service.py`.

**Q30. Полнотекстовый поиск без внешнего движка — как?**
Postgres FTS: у `TaxRule` генерируемая колонка `tsv` (`Computed`, persisted) с русским
словарём и весами — заголовок «A», тело «B» — под GIN-индексом. Никакого Elasticsearch для
справочника из сотен записей; ранжирование `ts_rank` из коробки. Это же паттерн ответа на
вопрос «когда НЕ нужен отдельный поисковый движок».
Где смотреть: `models.py::TaxRule`, `backend/src/api/v1/tax.py`.

---

## ЧАСТЬ 4. Смоук-чеклист тестировщика

Прогонять после каждого деплоя; порядок — сверху вниз (авторизация нужна всем страницам).

| Страница | Что проверить руками |
|---|---|
| **Логин/Регистрация** (`/login`, `/register`) | 1) Неверный пароль → сообщение об ошибке, БЕЗ редиректа. 2) Успешный логин → редирект на Обзор, cookie `access_token`/`refresh_token` httpOnly. 3) F5 после логина — сессия жива (refresh работает). 4) Logout → возврат на /login, повторный вход по «Назад» не открывает данные. |
| **Обзор** (`/`) | 1) Балансы (доход/расход/дельта) совпадают с суммой операций месяца. 2) QuickEntry: добавить расход → список операций и балансы обновились без F5. 3) Двойной сабмит одной операции (быстрый даблклик) → операция ОДНА (идемпотентность). 4) Health Score рисует кольцо и 3 фактора. 5) Колокольчик: badge непрочитанных, «прочитать всё» обнуляет счётчик. |
| **Операции** (`/transactions`) | 1) Пагинация и общий счётчик. 2) Фильтры: категория, тип, диапазон сумм/дат, поиск по комменту. 3) PATCH: изменить сумму → строка и балансы обновились. 4) DELETE: подтверждение, повторное удаление той же строки → корректная 404-обработка. 5) Экспорт CSV скачивается и открывается (UTF-8 BOM, кириллица цела). |
| **Бюджеты** (`/budgets` и блок на Обзоре) | 1) Создать конверт → появился без F5, ghost-карточка на месте. 2) Индекс дисциплины: `onTrack/total` соответствует карточкам, тир и цвет по порогам 40/70/90. 3) Перерасход конверта → розовая рамка, сумма перерасхода в индексе. 4) Копилка: видна только при экономии > 0; «Отложить в цель» → прогресс цели вырос, кнопка стала «Отложено ✓»; F5 → кнопка снова активна (известный дефект — не задублировать при проверках). 5) Бейдж Burn Rate на конверте, где расход обгоняет темп месяца на 10+ п.п. |
| **Аналитика** (`/analytics`) | 1) Круговая диаграмма категорий совпадает с фактами конвертов. 2) Кнопка «AI Анализ» → прогресс (SSE) → инсайт открывается; повторный запуск того же периода не дублирует историю. 3) История инсайтов листается, последний — сверху. 4) Психопаспорт отображает персону и рекомендации. |
| **Финплан** (`/savings-navigator`) | 1) Калькулятор: изменение суммы/срока пересчитывает месячный взнос. 2) «Сохранить как цель» → цель появилась в списках (и в Копилке). 3) Взнос в цель → прогресс-бар и `remaining` пересчитались; прогресс капится на 100%. 4) Удаление цели — исчезла из селекта Копилки. 5) Офферы банков: клик по офферу открывает партнёрскую ссылку (счётчик кликов — через админку). |
| **Игры** (`/games`) | 1) Каждая из 3 игр запускается и управляется (моб.: D-pad змейки). 2) Рекорд сохраняется: `POST /v1/games/score` → лидерборд обновился, личный рекорд не понижается меньшим результатом. 3) Общий зачёт = сумма игр. 4) Новый рекорд → уведомление в колокольчике (один раз, без дублей). |
| **Профиль** (`/settings/profile`) | 1) Смена имени/дохода сохраняется и переживает F5. 2) Привязка Telegram: OTP генерируется, после привязки бот отвечает на `500 кофе`. 3) API-ключи: создание показывает секрет ОДИН раз, отзыв деактивирует ключ. 4) Импорт CSV: повторный импорт того же файла не создаёт дублей (dedup); файл > 10 МБ → внятная ошибка, а не 413-страница nginx. 5) Виджет обратной связи отправляет сообщение (локально — видно в MailHog :8025). |

---

## Приложение: команды на память

```bash
# Полный локальный стек (+ mailhog из override)
docker compose up -d --build && docker compose exec backend alembic upgrade head

# Мониторинг
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Тесты
cd backend && pytest tests/unit -v                       # без БД, ~4.5 c
pytest tests/integration -v                              # нужен PG *_test
pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-fail-under=70
```
