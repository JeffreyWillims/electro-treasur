<p align="center">
  <img src="https://img.shields.io/badge/status-live-brightgreen?style=for-the-badge" alt="Status: Live" />
  <img src="https://img.shields.io/badge/python-3.12-blue?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/fastapi-0.136-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/postgresql-16-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
</p>

<h1 align="center">💎 Citrine Vault</h1>

<p align="center">
  <b>Премиальная финансовая система с ИИ-распознаванием чеков</b><br/>
  <sub>Полнофункциональное FinTech-приложение: от Glassmorphic UI до Savepoint-изолированных тестов</sub>
</p>

<p align="center">
  <a href="https://citrinevault.ru"><b>🌐 citrinevault.ru</b></a> &nbsp;·&nbsp;
  <a href="https://t.me/citrine_vault_bot"><b>🤖 Telegram Bot</b></a> &nbsp;·&nbsp;
  <a href="https://citrinevault.ru/docs"><b>📖 API Docs</b></a>
</p>

---

## ⚡ Что это

**Citrine Vault** — персональный финансовый трекер с ИИ-ассистентом, который распознаёт чеки и банковские выписки через OCR (Tesseract) и автоматически категоризирует расходы. Telegram-бот + веб-приложение с премиальным интерфейсом.

---

## 🚀 Release v1.1: Kinetic UX & Smart Cashflow

> Версия, в которой приложение стало быстрее, безопаснее и умнее — без единого рубля на LLM-инференс.

- 🔐 **Enterprise Security** — переход на Secure HttpOnly Cookies с refresh-токенами в Redis:
  сессии живут неделями, а токены недоступны из JavaScript даже при XSS.
- ⚡ **Rule-Based Insight Engine** — умный движок финансовых советов, работающий на чистых
  правилах: предупреждает о пробитом бюджете, ловит импульсивные покупки и подводит баланс
  месяца. Инсайты предрассчитываются в фоне (ARQ) и открываются мгновенно — **0 мс генерации,
  ноль нагрузки на сервер**.
- 📱 **Кинетическая мобильная адаптация** — нативные шторки (bottom sheets), жесты и плавные
  Framer Motion-переходы: веб-приложение ощущается как мобильное.
- 💬 **Асинхронная обратная связь** — Zero-blocking architecture: фидбек сохраняется и
  отправляется в фоне, интерфейс не ждёт ни секунды.

---

## 🏛️ Архитектура

```
                         ┌──────────────────────────────────────────────┐
                         │              Production Server               │
                         │                                              │
   Пользователь          │   ┌─────────┐     ┌──────────────────────┐  │
   ───────────────────────┼──▶│  Nginx  │────▶│  Frontend (React)    │  │
                         │   │  :80/443│     │  Vite + Tailwind CSS │  │
                         │   └────┬────┘     └──────────────────────┘  │
                         │        │                                     │
                         │        │ /api/*                              │
                         │        ▼                                     │
                         │   ┌──────────┐    ┌─────────┐   ┌────────┐  │
                         │   │ FastAPI  │───▶│PgBouncer│──▶│Postgres│  │
                         │   │ Uvicorn  │    │ :6432   │   │  16    │  │
                         │   │ :8000    │    └─────────┘   └────────┘  │
                         │   └────┬────┘                                │
                         │        │                                     │
                         │        ├──────────▶ Redis 7 (кэш, rate-limit)│
                         │        │                                     │
                         │        └──────────▶ Tesseract OCR (чеки)     │
                         │                                              │
                         └──────────────────────────────────────────────┘

   Telegram ──────────────────▶ Aiogram 3 Bot ──▶ FastAPI Services
```

---

## 🛠 Технологический стек

### Frontend

| Технология | Назначение |
|---|---|
| **React 18** + TypeScript | SPA с строгой типизацией |
| **Vite** | Сборка и HMR |
| **Tailwind CSS v3** | Утилитарные стили, glassmorphic UI |
| **Framer Motion** | Кинетические анимации, page transitions |
| **TanStack Query** | Серверный стейт, кэширование, оптимистичные обновления |
| **Recharts** | Графики и визуализация бюджетов |

### Backend

| Технология | Назначение |
|---|---|
| **FastAPI** (Python 3.12) | REST API, strict Pydantic v2, async |
| **SQLAlchemy 2.0** + asyncpg | Async ORM, NUMERIC(12,2) для денег |
| **Alembic** | Версионирование схемы БД |
| **Aiogram 3** | Telegram-бот (webhook / long-polling) |
| **Tesseract OCR** + PIL | Распознавание чеков и выписок |
| **OpenAI / Instructor** | LLM-интеграция для умной категоризации |
| **Pydantic v2** | Валидация, сериализация, настройки |

### Инфраструктура

| Технология | Назначение |
|---|---|
| **PostgreSQL 16** | Основное хранилище, JSONB, индексы |
| **PgBouncer** | Connection pooling (transaction mode, 200 pool) |
| **Redis 7** | Кэширование, rate-limiting, idempotency keys |
| **Nginx** | Reverse proxy, SSL/TLS, раздача статики |
| **Docker + Compose** | Контейнеризация всех сервисов |
| **GitHub Actions** | CI/CD: ruff → mypy → pip-audit → pytest → Docker → GHCR |

### Тестирование

| Инструмент | Назначение |
|---|---|
| **Pytest** + pytest-asyncio | Async test runner |
| **Hypothesis** | Property-based fuzzing (regex, budget math) |
| **Factory Boy** | Генерация тестовых данных |
| **Playwright** | E2E тесты (StorageState оптимизация) |
| **Nested Savepoints** | Изоляция тестов без очистки БД |

---

## ✨ Ключевые возможности

- 📸 **OCR чеков** — сфотографируй чек, бот распознает сумму и категорию
- 📊 **Бюджетные конверты** — планируй расходы по категориям с визуальным прогрессом
- 🤖 **Telegram-бот** — быстрый ввод: `500 кофе` → транзакция создана
- 🔒 **Idempotency Keys** — защита от двойных списаний на уровне БД
- 🧮 **Safe-to-Spend** — сколько можно тратить в день до конца месяца
- 📈 **Дашборд** — доходы/расходы/дельта по категориям за период
- 🌙 **Glassmorphic UI** — премиальный дизайн с backdrop-blur и градиентами

---

## 🚀 Быстрый старт

### Требования

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- Git

### Запуск

```bash
# 1. Клонировать
git clone https://github.com/JeffreyWillims/electro-treasur.git
cd electro-treasur

# 2. Настроить окружение
cp backend/.env.example backend/.env
# → отредактируй .env: JWT Secret, Telegram Token, DB credentials

# 3. Поднять инфраструктуру
docker-compose up -d --build

# 4. Применить миграции
docker-compose exec backend alembic upgrade head
```

### Доступ

| Сервис | URL |
|---|---|
| Frontend | http://localhost |
| API Docs (Swagger) | http://localhost:8000/docs |
| PgBouncer (PostgreSQL) | `localhost:6432` |

---

## 🧪 Тестирование

```bash
cd backend

# Unit-тесты (без БД, < 10 сек)
pytest tests/unit -v

# Integration-тесты (нужна PostgreSQL _test)
pytest tests/integration -v

# Всё вместе с покрытием
pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-fail-under=70
```

**110 тестов** по всей пирамиде:

```
Unit:        93  (OCR parsing, budget math, dashboard aggregation)
Integration: 15  (API endpoints, DB constraints, CASCADE)
E2E:          2  (Playwright: login flow, dashboard)
```

---

## 📁 Структура проекта

```
electro-treasur/
├── frontend/                   # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/         # UI-компоненты (dashboard, modals, charts)
│   │   ├── api/                # API-клиент (TanStack Query)
│   │   ├── context/            # Auth, Theme контексты
│   │   └── types/              # TypeScript типы
│   └── Dockerfile              # Nginx + статика
│
├── backend/                    # FastAPI + Python 3.12
│   ├── src/
│   │   ├── api/routes/         # REST endpoints
│   │   ├── domain/models.py    # SQLAlchemy ORM (User, Category, Transaction, Budget)
│   │   ├── services/           # Бизнес-логика (OCR, dashboard, auth)
│   │   ├── infrastructure/     # Telegram bot (Aiogram 3)
│   │   └── schemas/            # Pydantic v2 schemas
│   ├── tests/
│   │   ├── unit/               # Hypothesis + FakeRepo
│   │   ├── integration/        # PostgreSQL + Savepoints
│   │   ├── e2e/                # Playwright
│   │   └── factories/          # Factory Boy
│   └── Dockerfile              # Multi-stage (builder → runtime)
│
├── docker-compose.yml          # Postgres + PgBouncer + Redis + Backend + Frontend + Bot
├── .github/workflows/ci.yml    # Unified CI/CD pipeline
└── k8s/                        # Kubernetes manifests
```

---

## 🔄 CI/CD Pipeline

```
push / PR → main
      │
      ├── 🔍 lint          ruff check + ruff format + mypy + pip-audit
      │
      ├── ⚛️ frontend       tsc --noEmit + vite build
      │
      ├── 🧪 test           PostgreSQL 16 + pytest (coverage ≥ 70%)
      │
      └── 🐳 build          Docker multi-stage → GHCR (main push only)
```

Concurrency control: автоотмена предыдущих запусков для одной ветки.

---

## 🔐 Безопасность

- **JWT** — access/refresh токены с RS256
- **Argon2id** — хеширование паролей
- **Rate Limiting** — SlowAPI + Redis (защита от брутфорса)
- **Idempotency Keys** — UNIQUE constraint на уровне PostgreSQL
- **Savepoint Isolation** — дубликаты в батч-импорте не убивают транзакцию
- **Non-root Docker** — production-контейнер работает от `appuser`
- **pip-audit** — CVE-сканирование зависимостей в CI

---

## 📜 Лицензия

Все права защищены. Разработано с вниманием к каждой детали.

<p align="center">
  <a href="https://citrinevault.ru"><b>🌐 citrinevault.ru</b></a>
</p>