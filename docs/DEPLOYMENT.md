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
  └─ 🐳 build      (needs: test, frontend; только push в main)
                   Docker multi-stage build ./backend → push в GHCR
                   Теги: короткий SHA + latest
```

- `test`-джоб явно ждёт `lint` (`needs: lint`), `build` ждёт и `test`, и `frontend` — линт не
  блокирует сборку фронтенда, но блокирует тесты бэкенда.
- E2E-тесты (Playwright) в CI **не запускаются** (`-m "not e2e"`) — только unit + integration.
- Секреты в тестовом джобе — заглушки (`ci-test-secret-key-not-for-production-...`,
  `fake:token`), реальные секреты в CI не используются.

## Откат (rollback)

Явного скрипта отката в репозитории нет. На практике это означает:

- **Docker Compose**: указать предыдущий тег образа (короткий SHA из истории GHCR-пушей) вместо
  `latest` в конфиге сервиса `backend`/`telegram-bot`/`arq-worker`, затем
  `docker compose up -d --no-deps backend`.
- **Kubernetes**: `kubectl rollout undo deployment/fastapi-app` (стандартный механизм K8s,
  манифест не переопределяет стратегию деплоя).
- Миграции Alembic откатываются вручную: `alembic downgrade -1` — CD-пайплайн миграции
  автоматически не применяет и не откатывает (см. `docker-compose exec backend alembic upgrade head`
  как ручной шаг в разделе "Локальный запуск").

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
