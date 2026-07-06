# Деплой и CI/CD

## Переменные окружения

Источник — `backend/.env.example` (копируется в `backend/.env`, не коммитится). Все переменные
читаются через `pydantic-settings` с префиксом `ET_`.

| Переменная | Обязательна | Назначение |
|---|---|---|
| `ET_SECRET_KEY` | да | Секрет для подписи JWT (сгенерировать: `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `ET_ALGORITHM` | нет (default `HS256`) | Алгоритм подписи JWT |
| `ET_DATABASE_URL` | да | `postgresql+asyncpg://...` — прод обычно указывает на `pgbouncer:6432`, а не напрямую на Postgres |
| `ET_REDIS_URL` | да | Кэш/rate-limit/idempotency |
| `ET_ARQ_REDIS_URL` | да | Отдельная БД Redis для очереди фоновых задач (ARQ) |
| `ET_DB_POOL_SIZE` / `ET_DB_MAX_OVERFLOW` | нет | Тюнинг пула соединений SQLAlchemy |
| `ET_REDIS_INSIGHT_TTL` | нет | TTL для кэша инсайтов |
| `ET_TELEGRAM_BOT_TOKEN` | да (для бота) | Токен Telegram-бота от @BotFather |

Никогда не хардкодить эти значения в коде — только через `.env`.

## Локальный запуск

```bash
git clone https://github.com/JeffreyWillims/electro-treasur.git
cd electro-treasur

cp backend/.env.example backend/.env
# отредактировать backend/.env

docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Доступ: фронтенд — `http://localhost`, Swagger — `http://localhost:8000/docs`,
PgBouncer — `localhost:6432` (для отладки).

## Продакшн

```bash
# Прод-оверлей поверх базового compose: подменяет nginx-конфиг на SSL-вариант
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- `docker-compose.prod.yml` — единственное отличие от базового файла: том
  `frontend/nginx.prod.conf` вместо `frontend/nginx.conf` (SSL, Let's Encrypt,
  `server_name citrinevault.ru www.citrinevault.ru 212.193.26.26`).
- SSL-сертификаты подключаются с хоста через `/etc/letsencrypt` (volume, read-only) — обновление
  сертификатов (certbot) не входит в docker-compose и должно выполняться на хосте отдельно.
- Мониторинг разворачивается отдельным стеком:
  `docker compose -f docker-compose.monitoring.yml up -d` (Prometheus/Grafana/Alertmanager/cAdvisor).

### Kubernetes (`k8s/`)

Манифесты покрывают **только** часть сервисов — FastAPI (Deployment + Service + HPA), ARQ worker и
PgBouncer. Манифестов для Postgres, Redis и frontend в `k8s/` нет — эти части предполагаются
внешними/управляемыми отдельно, либо K8s-манифесты пока неполные.

- `fastapi-deployment.yaml`: 3 реплики, образ `ghcr.io/electro-treasur/backend:latest`,
  `DATABASE_URL`/`REDIS_URL` из `Secret` `electro-secrets`, liveness/readiness пробы на `/docs`
  (не на `/health` — расхождение с Docker Compose healthcheck, который бьёт в `/health`).
  Заметь: путь образа в манифесте (`ghcr.io/electro-treasur/backend`) не совпадает с тем, что
  реально пушит CI (`ghcr.io/${{ github.repository }}/backend`, т.е. репозиторий
  `JeffreyWillims/electro-treasur`) — при реальном деплое в K8s это нужно будет исправить.
- `fastapi-hpa.yaml`: `minReplicas: 3`, `maxReplicas: 100`, автоскейлинг по CPU (target 70%).

## CI/CD (`.github/workflows/ci.yml`)

Единый пайплайн `CI/CD`, запускается на `push`/`pull_request` в `main`, с
concurrency-группой `ci-${{ github.ref }}` (автоотмена предыдущих запусков той же ветки).

```
push / PR → main
  │
  ├─ 🔍 lint      ruff check → ruff format --check → mypy src/ → pip-audit
  │
  ├─ ⚛️ frontend   tsc --noEmit → vite build
  │
  ├─ 🧪 test       (needs: lint) PostgreSQL 16 сервис-контейнер + Tesseract OCR
  │                → pytest tests/unit tests/integration -m "not e2e"
  │                → coverage ≥ 70% (--cov-fail-under=70)
  │                → JUnit + coverage.xml как артефакты (30 дней)
  │
  ├─ 🐳 build      (needs: test, frontend; только push в main)
  │                Docker multi-stage build ./backend → push в GHCR
  │                Теги: короткий SHA + latest
  │
  └─ 🚀 deploy     (needs: build; только push в main)
                   SSH на VPS → git pull → compose pull (GHCR)
                   → alembic upgrade head (до переключения контейнеров!)
                   → build frontend → up -d
```

### Автодеплой (deploy-job)

Требуемые GitHub Secrets (Settings → Secrets → Actions):

| Секрет | Значение |
|---|---|
| `VPS_HOST` | IP/домен сервера |
| `VPS_USER` | SSH-пользователь |
| `VPS_SSH_KEY` | приватный ключ (пара к authorized_keys на VPS) |
| `VPS_PROJECT_DIR` | путь к клону репозитория на сервере |

Прод-оверлей `docker-compose.prod.yml` пинит `backend`/`arq-worker`/`telegram-bot` на
`ghcr.io/jeffreywillims/electro-treasur/backend:latest` — сервер больше НЕ собирает
Python-образы из исходников (Immutable Infrastructure). Frontend (статика) собирается
на месте, т.к. CI его образ не публикует.

Миграции применяются НОВЫМ образом **до** `up -d`, пока старые контейнеры ещё обслуживают
трафик — поэтому каждая миграция обязана быть backward-compatible (expand-contract,
см. ниже «Zero-Downtime миграции»).

- `test`-джоб явно ждёт `lint` (`needs: lint`), `build` ждёт и `test`, и `frontend` — линт не
  блокирует сборку фронтенда, но блокирует тесты бэкенда.
- E2E-тесты (Playwright) в CI **не запускаются** (`-m "not e2e"`) — только unit + integration.
- Секреты в тестовом джобе — заглушки (`ci-test-secret-key-not-for-production-...`,
  `fake:token`), реальные секреты в CI не используются.

## Первый автодеплой — чек-лист

**Шаг 0 — бэкап БД на VPS (обязательно, ДО пуша в main):**

```bash
docker compose exec -T postgres pg_dump -U electro -Fc electro_treasur > backup_$(date +%F).dump
# восстановление при необходимости:
# cat backup_YYYY-MM-DD.dump | docker compose exec -T postgres pg_restore -U electro -d electro_treasur --clean
```

**Новая база НЕ нужна.** `alembic upgrade head` обновляет схему существующей базы на месте,
данные пользователей сохраняются (миграция `e7a8b9c0d1f2` — чисто аддитивная).
**Фикстуры не нужны:** категории сеются автоматически при регистрации
(`user_service.create_user`), партнёрские офферы ведутся через `/admin`.

**Шаг 1 — проверить `backend/.env` на VPS:**

| Переменная | Проверка |
|---|---|
| `ET_SECRET_KEY` | задан (без него все Python-контейнеры крашатся на старте) |
| `ET_ADMIN_PASSWORD` | задан (с пустым — в `/admin` невозможно войти) |
| `ET_TELEGRAM_BOT_TOKEN` | токен именно **@citrine_vault_bot**: `curl -s "https://api.telegram.org/bot$TOKEN/getMe"` → `username` = `citrine_vault_bot`. Deep-link привязки на фронте захардкожен на этого бота (`ProfileSettings.tsx`) |
| `ET_COOKIE_SECURE` | НЕ задан или `true` (HTTPS-прод) |

**Шаг 2 — GitHub Secrets** (Settings → Secrets → Actions): `VPS_HOST`, `VPS_USER`,
`VPS_SSH_KEY`, `VPS_PROJECT_DIR` — см. таблицу выше.

**Шаг 3 — пуш в main.** Actions прогонит lint → test → build → deploy; деплой сам сделает
`compose pull` (GHCR), `alembic upgrade head` и `up -d`.

**Шаг 4 — проверка после деплоя:**

```bash
curl -s https://citrinevault.ru/api/v1/health          # {"status":"ok"}
docker compose ps                                      # все Up / healthy
docker compose exec backend alembic current            # e7a8b9c0d1f2 (head)
```

**Если пошло не так** — раздел «Откат» ниже: pull предыдущего sha-тега + `up -d`;
аддитивную миграцию откатывать не обязательно.

## Откат (rollback)

Явного скрипта отката в репозитории нет. На практике это означает:

- **Docker Compose**: указать предыдущий тег образа (короткий SHA из истории GHCR-пушей) вместо
  `latest` в конфиге сервиса `backend`/`telegram-bot`/`arq-worker`, затем
  `docker compose up -d --no-deps backend`.
- **Kubernetes**: `kubectl rollout undo deployment/fastapi-app` (стандартный механизм K8s,
  манифест не переопределяет стратегию деплоя).
- Миграции Alembic откатываются вручную: `alembic downgrade -1`. Применяет их CD-пайплайн
  (шаг `run --rm backend alembic upgrade head` в deploy-job), откат — только руками.

## Zero-Downtime миграции (правило expand-contract)

Deploy-job запускает миграции, пока старые контейнеры ещё работают. Поэтому миграция и код
одного релиза обязаны быть совместимы со СТАРЫМ кодом:

1. **Expand (релиз N)**: только аддитивные изменения — новая колонка (nullable или с default),
   новая таблица, новый индекс (`CREATE INDEX CONCURRENTLY` для больших таблиц). Старый код
   такие изменения не замечает.
2. **Migrate (релиз N)**: новый код пишет в новую структуру, читает из обеих.
3. **Contract (релиз N+1 или позже)**: удаление старой колонки/таблицы — отдельной миграцией,
   когда ни одна работающая версия кода к ней не обращается.

Запрещено в одном релизе: `DROP COLUMN` / `RENAME` используемых полей, `NOT NULL` без default
на существующей таблице, долгие блокирующие `ALTER` без `lock_timeout`.

## Healthcheck-и

| Сервис | Проверка | Где определена |
|---|---|---|
| `backend` | `GET /health` — пингует Postgres (`SELECT 1`) и Redis; `503` при сбое | `docker-compose.yml` (Docker HEALTHCHECK) и `src/main.py` |
| `backend` (K8s) | `GET /docs` (не `/health`) | `k8s/fastapi-deployment.yaml` |
| `postgres` | `pg_isready` | `docker-compose.yml` |
| `redis` | `redis-cli ping` | `docker-compose.yml` |
| `telegram-bot`, `arq-worker` | Отключены (`disable: true`) — нет HTTP-сервера, унаследованный чек на `:8000` ложно фейлился бы | `docker-compose.yml` |

## Nginx

Два конфига, не путать:

- `frontend/nginx.conf` — локальный, `listen 80`, без SSL.
- `frontend/nginx.prod.conf` — прод, редирект 80→443, SSL через Let's Encrypt, дополнительные
  заголовки `X-Forwarded-For`/`X-Forwarded-Proto`.

Оба проксируют `location /api/` → `http://backend:8000/` (префикс `/api/` обрезается) и
`location /admin` → SQLAdmin-панель бэкенда. Подробности маршрутизации — в `docs/API_REFERENCE.md`.
