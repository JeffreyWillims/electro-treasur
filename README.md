<p align="center">
  <img src="https://img.shields.io/badge/status-live-brightgreen?style=flat-square" alt="Status: Live" />
  <img src="https://img.shields.io/badge/python-3.12-blue?style=flat-square&logo=python&logoColor=white" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/FastAPI-0.139-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI 0.139" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
</p>

<h1 align="center">💎 Citrine Vault</h1>

<p align="center">
  <b>Личные финансы, которые не хочется бросить через неделю.</b><br/>
  <sub>Учёт денег, бюджетные конверты, аналитика, распознавание чеков и немного игр — в одном приложении с характером.</sub>
</p>

<p align="center">
  <a href="https://citrinevault.ru"><b>🌐 citrinevault.ru</b></a> &nbsp;·&nbsp;
  <a href="https://t.me/citrine_vault_bot"><b>🤖 Telegram-бот</b></a> &nbsp;·&nbsp;
  <a href="https://citrinevault.ru/docs"><b>📖 API Docs</b></a>
</p>

---

## Привет 👋

Это Citrine Vault — приложение для личных финансов, которое я делаю как продукт, а не как учебный проект. Идея простая: большинство финансовых трекеров бросают через неделю, потому что вести их — работа. Я хотел обратное — чтобы заносить траты было быстро (голосом, из Telegram, фоткой чека), чтобы цифры сразу складывались в понятную картину, и чтобы в приложение хотелось возвращаться.

Отсюда три принципа, вокруг которых всё построено:

- **Меньше трения.** Ввод в одно действие: `500 кофе` в бота, диктовка суммы голосом, импорт выписки. Никаких форм на десять полей.
- **Польза без счёта за облако.** Финансовые советы работают на честных правилах, а не на LLM за каждый запрос — предрасчитываются в фоне и открываются мгновенно. **0 ₽ на инференс.**
- **Приятно пользоваться.** Стеклянный интерфейс, тёмная тема, живые анимации, мобильные шторки. Финансы могут выглядеть дорого.

Ниже — что внутри и как это устроено. Старался быть честным: где решение спорное — говорю прямо.

---

## Что умеет

**Деньги и учёт**
- 📸 **Распознавание чеков** — сфоткал чек, OCR (Tesseract) вытащил сумму и категорию.
- 📄 **Импорт выписок** — банковский PDF, CSV, Excel → транзакции, с дедупликацией.
- 🎙️ **Голосовой ввод** — диктуешь сумму, Web Speech API превращает в транзакцию.
- 🤖 **Telegram-бот** — `500 кофе` прямо в чат, и запись готова.
- 🔁 **Автокатегоризация** — правила по мерчантам раскидывают траты сами.

**Планирование**
- 📊 **Бюджетные конверты** — лимиты по категориям с наглядным прогрессом.
- 🎯 **Цели** — копилки с целевой суммой и пополнениями.
- 🧮 **Безопасный лимит** — сколько можно тратить в день до конца месяца, с учётом уже потраченного и зарезервированного по конвертам.
- 🧭 **Финплан** — симуляция накоплений и подбор вкладов под цель, с выгрузкой персонального PDF-плана.

**Аналитика и AI**
- 📈 **Дашборд** — доходы, расходы, дельта по категориям, динамика капитала.
- ❤️ **Финансовое здоровье** — сводный скоринг по нескольким факторам.
- 💡 **Инсайты** — движок на правилах: ловит пробитый бюджет, импульсивные покупки, подводит итог месяца. Считаются в фоне (ARQ), открываются мгновенно.
- 🧠 **Психопаспорт** — поведенческий профиль трат: тип «финансовой личности», наблюдения и мягкие советы.

**Ещё**
- 🎮 **Citrine Arcade** — три мини-игры (Десятка, Купюра 512 ₽, Устный счёт) с рейтингом топ-100 и общим зачётом. Небольшой повод заходить чаще.
- 👥 **Кабинет консультанта** — режим с ролевым доступом: советник видит клиентов и их операции.
- 🧾 **Налоги** — калькулятор вычетов и справочник по режимам (РФ).
- 🔑 **Публичный API** — ключи `cv_…` для программного доступа к своим данным.

---

## Архитектура

```
                         ┌──────────────────────────────────────────────┐
                         │              Production Server                │
   Пользователь          │                                              │
   ─────────────────────▶│   ┌─────────┐     ┌──────────────────────┐   │
                         │   │  Nginx  │────▶│  Frontend (React 19) │   │
                         │   │ :80/443 │     │  Vite 8 · Tailwind   │   │
                         │   └────┬────┘     └──────────────────────┘   │
                         │        │ /api/*                              │
                         │        ▼                                     │
                         │   ┌──────────┐   ┌─────────┐   ┌──────────┐  │
                         │   │ FastAPI  │──▶│PgBouncer│──▶│ Postgres │  │
                         │   │ Uvicorn  │   │  :6432  │   │    16    │  │
                         │   │  :8000   │   └─────────┘   └──────────┘  │
                         │   └────┬─────┘                               │
                         │        ├───────────▶ Redis 7  (кэш, сессии,  │
                         │        │              rate-limit, idempotency)│
                         │        ├───────────▶ ARQ worker (инсайты,    │
                         │        │              напоминания, cron)      │
                         │        └───────────▶ Tesseract OCR (чеки)     │
                         └──────────────────────────────────────────────┘

   Telegram ──────────────▶ Aiogram 3 Bot ──▶ FastAPI Services
```

Бэкенд — слоистая (light-DDD) архитектура: тонкие роутеры → сервисы с бизнес-логикой → доменные модели → Pydantic-схемы. Путь запроса: `router → Depends(get_current_user)` (аутентификация из httpOnly-куки) → сервис с `AsyncSession`/`Redis` → модели → типизированный ответ. OpenAPI-схема — это контракт: фронтенд забирает из неё TypeScript-типы.

Фронтенд — React 19 + Vite 8 (rolldown), маршруты через react-router 7, серверный стейт на TanStack Query. Тяжёлые страницы (аналитика, игры) вынесены в ленивые чанки, чтобы старт был лёгким.

---

## Стек

### Frontend

| Технология | Версия | Зачем |
|---|---|---|
| **React** + TypeScript | 19.2 | SPA со строгой типизацией |
| **Vite** | 8.0 (rolldown) | Сборка, HMR, ленивые чанки |
| **Tailwind CSS** | 3.4 | Утилитарные стили, glassmorphism |
| **TanStack Query** | 5.91 | Серверный стейт, кэш, инвалидация |
| **Framer Motion** | 12.38 | Кинетические анимации, переходы |
| **Recharts** | 3.8 | Графики и визуализация бюджетов |
| **vite-plugin-pwa** | 1.3 | Установка на телефон, офлайн-оболочка |
| **@sentry/react** | 10.67 | Мониторинг ошибок клиента (по DSN) |
| **Vitest** | 4.1 | Юнит-тесты (jsdom) |

### Backend

| Технология | Версия | Зачем |
|---|---|---|
| **FastAPI** (Python 3.12) | 0.139 | Async REST API, Pydantic v2 |
| **SQLAlchemy** + asyncpg | 2.0 | Async ORM, `NUMERIC(12,2)` для денег |
| **Alembic** | 1.18 | Миграции (18 ревизий, zero-downtime) |
| **ARQ** | 0.28 | Фоновые задачи и cron на Redis |
| **Aiogram** | 3.x | Telegram-бот |
| **python-jose** / argon2-cffi | — | JWT (HS256) + хеширование паролей Argon2 |
| **slowapi** | 0.1.9 | Rate limiting на Redis |
| **SQLAdmin** | 0.27 | Админ-панель `/admin` |
| **Tesseract / pdfplumber / fpdf2** | — | OCR чеков, разбор PDF-выписок, генерация отчётов |

### Инфраструктура

| Технология | Зачем |
|---|---|
| **PostgreSQL 16** | Основное хранилище, JSONB, FTS |
| **PgBouncer** | Пул соединений (transaction mode) |
| **Redis 7** | Кэш, refresh-сессии, rate-limit, idempotency, брокер ARQ |
| **Nginx** | Reverse proxy, SSL/TLS, статика |
| **Docker Compose** | Оркестрация всех сервисов |
| **Prometheus + Grafana** | Метрики и дашборды (отдельный стек) |
| **GitHub Actions** | CI/CD: ruff → mypy → pip-audit → pytest → Docker → GHCR |

---

## Инженерные решения, которыми доволен

Не всё здесь очевидно, поэтому вот то, что мне действительно нравится:

- **Refresh-токены с ротацией и детекцией повторного использования.** Access-токен — короткий JWT (15 мин) в httpOnly-куке. Refresh — не JWT, а непрозрачная строка в Redis с TTL 7 дней: при обновлении старый отзывается сразу, повторное использование ловится. Это надёжнее stateless-JWT-refresh и позволяет мгновенно разлогинить сессию.
- **Идемпотентность создания транзакций.** Заголовок `Idempotency-Key`: быстрая проверка в Redis (O(1)), но источник правды — `UNIQUE`-констрейнт в Postgres. Двойное списание не пройдёт даже в гонке.
- **Rate limiting, общий для всех воркеров.** slowapi поверх Redis — счётчики шарятся между всеми репликами uvicorn, реальный IP берётся из доверенных ProxyHeaders за nginx.
- **Инсайты за 0 ₽.** Финансовые советы — движок на правилах, а не LLM. Считаются в фоне (ARQ), в UI открываются мгновенно и не нагружают сервер.
- **Изоляция тестов через SAVEPOINT.** Каждый тест катится в собственной вложенной транзакции и откатывается после — база не чистится между тестами, прогон быстрый. Плюс защита: conftest **падает**, если `DATABASE_URL` не заканчивается на `_test`.
- **Устойчивость фронта.** Error Boundaries вокруг каждой страницы и всего приложения — сбой в одном виджете не роняет весь UI, показывается аккуратная плашка, сайдбар живёт.
- **PWA без риска для данных.** Офлайн кэшируется только статическая оболочка; `/api` и `/v1` намеренно не кэшируются — устаревший баланс опаснее его отсутствия.
- **Fail-fast старт.** На старте бэкенд пингует Postgres и Redis и не принимает трафик, пока зависимости не отвечают.

---

## Быстрый старт

Нужны только [Docker](https://docs.docker.com/get-docker/) + Compose и Git.

```bash
# 1. Клонировать
git clone https://github.com/JeffreyWillims/electro-treasur.git
cd electro-treasur

# 2. Настроить окружение (JWT-секрет, Telegram-токен, доступ к БД)
cp backend/.env.example backend/.env
#   → отредактируй backend/.env

# 3. Поднять всё
docker compose up -d --build

# 4. Применить миграции
docker compose exec backend alembic upgrade head
```

| Сервис | URL |
|---|---|
| Frontend | http://localhost |
| API Docs (Swagger) | http://localhost:8000/docs |
| PgBouncer | `localhost:6432` |

Деплой на прод и обновление сервера — в [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) и [docs/SERVER_UPDATE_PLAN.md](docs/SERVER_UPDATE_PLAN.md). Мониторинг и безопасная публикация наружу — в [docs/AGENT_RUNBOOK.md](docs/AGENT_RUNBOOK.md).

---

## Тесты

**Backend** — 488 тестов проходят (unit + integration), полная пирамида:

```bash
cd backend

# всё, кроме e2e, с покрытием
pytest -m "not e2e" --cov=src --cov-fail-under=70

# только быстрые unit (без БД)
pytest tests/unit -v
```

- **unit** — чистая логика: налоги, математика бюджетов, парсинг OCR, движок инсайтов, психопаспорт (в т.ч. property-тесты на Hypothesis).
- **integration** — реальный Postgres: эндпоинты, констрейнты, ротация refresh-токенов, security-инварианты.
- **e2e** — Playwright, пользовательский сценарий (в CI не гоняется).

**Frontend** — Vitest + jsdom. Пока покрыта логика синхронизации игровых рекордов ([gameRecords.test.ts](frontend/src/lib/gameRecords.test.ts)); тестов на компоненты ещё нет — это честная зона роста.

```bash
cd frontend && npm run test
```

---

## Структура проекта

```
electro-treasur/
├── frontend/                      # React 19 + Vite 8 + TypeScript
│   └── src/
│       ├── components/            # по доменам: dashboard, budgets, analytics,
│       │                          #   games, consultant, insights, profile, ui…
│       ├── api/                   # типизированный клиент (cookie-auth, авто-refresh)
│       ├── context/               # Auth, Theme
│       ├── lib/                   # monitoring, gameRecords, dateUtils (МСК), queryClient
│       └── main.tsx / App.tsx     # провайдеры, роутинг, Error Boundaries
│
├── backend/                       # FastAPI + Python 3.12
│   └── src/
│       ├── api/{v1,v2,analytics}/ # роутеры (v1 — cookie, v2 — API-ключи)
│       ├── services/              # бизнес-логика (17 модулей)
│       ├── domain/models.py       # ORM-модели + enum-ы
│       ├── schemas/               # Pydantic v2 DTO
│       ├── infrastructure/        # Redis, ARQ-воркеры, Telegram-бот
│       └── core/                  # исключения, rate-limit
│
├── docker-compose.yml             # Postgres · PgBouncer · Redis · Backend · Frontend · Bot
├── docker-compose.monitoring.yml  # Prometheus · Grafana · Alertmanager · exporters
├── docs/                          # деплой, схема БД, API, ранбуки
├── k8s/                           # Kubernetes-манифесты (частичные)
└── .github/workflows/ci.yml       # единый CI/CD-пайплайн
```

---

## CI/CD

```
push / PR → main
      │
      ├── 🔍 lint       ruff check + ruff format + mypy + pip-audit
      ├── ⚛️ frontend    tsc --noEmit + vite build
      ├── 🧪 test        PostgreSQL 16 + pytest (покрытие ≥ 70%)
      ├── 🐳 build       Docker multi-stage → GHCR (только push в main)
      └── 🚀 deploy      SSH на VPS → миграции новым образом → up -d
```

Concurrency-группа автоотменяет предыдущие запуски той же ветки. Миграции применяются **до** переключения контейнеров, пока старые ещё обслуживают трафик — поэтому каждая миграция обязана быть backward-compatible (expand-contract).

---

## Безопасность

- **JWT HS256** в httpOnly-куке (access, 15 мин) + **непрозрачный refresh в Redis** с ротацией и отзывом.
- **Argon2id** для паролей; защита от timing-атак на логине (dummy-хэш).
- **Rate limiting** (slowapi + Redis) — общий для всех воркеров.
- **Idempotency-Key** — `UNIQUE`-констрейнт в Postgres как источник правды.
- **Валидатор инвариантов конфига** — прод не стартует со слабым секретом, localhost-CORS или небезопасной кукой.
- **Non-root Docker**, `pip-audit` в CI, RBAC для кабинета консультанта.

---

## Лицензия

Все права защищены. Проект живой и развивается — сделано с вниманием к каждой детали.

<p align="center">
  <a href="https://citrinevault.ru"><b>🌐 citrinevault.ru</b></a> &nbsp;·&nbsp;
  <a href="https://t.me/citrine_vault_bot"><b>🤖 @citrine_vault_bot</b></a>
</p>
