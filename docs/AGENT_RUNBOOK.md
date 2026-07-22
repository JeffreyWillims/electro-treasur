# Agent Runbook — рекорды игр, деплой изменений, мониторинг

Инструкция для агента/человека, который поднимает **этот набор изменений**
(тесты рекордов игр + сборка фронта с PWA / Sentry / Error Boundaries) на сервер,
проверяет их и работает с мониторингом.

Общий процесс деплоя НЕ дублируем — он в [DEPLOYMENT.md](DEPLOYMENT.md) и
пошагово для VPS в [SERVER_UPDATE_PLAN.md](SERVER_UPDATE_PLAN.md). Здесь — только
дельта этого релиза и то, что спросили дополнительно.

---

## A. Что в этом релизе

| Область | Файлы | Нужна пересборка |
|---|---|---|
| Синк рекордов игр (фикс: слать всегда + backfill + обновление рейтинга) | `frontend/src/lib/gameRecords.ts` | frontend |
| Тесты рекордов (клиент + сервер) | `frontend/src/lib/gameRecords.test.ts`, `backend/tests/integration/test_games.py` | — (только CI/локально) |
| Error Boundaries | `frontend/src/components/ui/ErrorBoundary.tsx`, `App.tsx` | frontend |
| Sentry (по DSN) | `frontend/src/lib/monitoring.ts`, `main.tsx` | frontend |
| PWA | `vite.config.ts`, `public/pwa-*`, `nginx.conf`, `index.html` | frontend |
| Безопасный лимит / персиковый акцент | `frontend/src/components/dashboard/SafeToSpend.tsx` | frontend |

**Миграции БД НЕ требуются** — таблица `game_scores` уже существует, схема не менялась.
**Бэкенд-образ пересобирать не обязательно** — Python-код не тронут (изменены только
тесты, которые в прод-образ не попадают). Достаточно **пересобрать frontend**.

### Поднять на сервере (дельта поверх SERVER_UPDATE_PLAN)

```bash
cd <PROJECT_DIR>
git pull origin main

# только фронт — бэкенд-код не менялся:
docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --no-deps frontend
docker compose ps      # frontend Up
```

Если хотите включить Sentry — передайте DSN на этапе сборки (Vite инлайнит `VITE_*`):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build \
  --build-arg VITE_SENTRY_DSN="https://<key>@<org>.ingest.sentry.io/<proj>" frontend
```

Без `--build-arg` фронт собирается **без** мониторинга ошибок — это валидно, кода Sentry
в бандле не будет вовсе.

---

## B. Проверка «запись очков и отображение у клиента»

### Автотесты (быстрый, надёжный путь)

```bash
# Фронт — логика синка рекордов (jsdom, моки сети):
cd frontend && npm run test        # ожидаемо: 5 passed

# Бэкенд — запись + рейтинг (нужен тестовый Postgres, см. SERVER_UPDATE_PLAN / память):
cd backend && ET_DATABASE_URL="postgresql+asyncpg://electro:electro_secret@localhost:5434/electro_treasur_test" \
  .venv/bin/python -m pytest tests/integration/test_games.py -q   # 7 passed
```

Что стерегут тесты: `submitScore` шлёт результат на сервер **даже когда локальный рекорд
не побит** (это и был баг «новых игроков нет в рейтинге»), backfill старых рекордов,
обновление рейтинга после отправки; на сервере — best-only upsert, «Общий зачёт» = сумма
лучших, имя = `full_name` (e-mail не утекает).

### Ручной сценарий (F12) — КАК ЕСТЬ, без мифов

> ⚠️ Вопреки распространённой гипотезе, здесь **нет** краша `Cannot read properties of null`.
> Рекорд читается из `localStorage` (`getBest` уже null-safe), объекта `user.game_scores`
> в коде нет. Не ищите эту ошибку — её не будет.

1. Инкогнито → `https://citrinevault.ru` → регистрация нового пользователя.
2. F12 → вкладка **Network**, фильтр `score`.
3. Раздел «Игры» → сыграть в любую (Десятка / Купюра 512 / Устный счёт) до конца.
4. Через ~4 сек (debounce) в Network появляется `POST /api/v1/games/score` → `200 {"status":"ok"}`.
   Консоль чистая.
5. Открыть рейтинг игроков — новый игрок в списке; «Общий зачёт» открыт по умолчанию.
6. Сыграть ещё раз — список обновляется **без перезагрузки** (инвалидация кэша).

---

## C. Что ещё проверить после деплоя

- **PWA-установка**: на телефоне открыть сайт → меню браузера → «Установить/На экран
  Домой». Иконка — арка-сейф с цитрином на зелёном фоне, запуск без адресной строки.
- **Обновляемость SW**: `curl -sI https://citrinevault.ru/sw.js | grep -i cache-control`
  → `no-cache` (иначе новая сборка не долетит до установленного PWA).
- **Оффлайн-режим**: в самолётном режиме приложение открывается (оболочка), но
  финансовые данные не показываются — так и задумано, `/api` и `/v1` намеренно не кэшируются.
- **Error Boundary**: при сбое в одной странице — стеклянная плашка «раздел временно
  недоступен» и кнопка «Попробовать снова», сайдбар и остальное живут.
- Общий смоук — из [SERVER_UPDATE_PLAN.md](SERVER_UPDATE_PLAN.md) §6–7.

---

## D. Мониторинг — что доступно и как открыть

Отдельный стек, поднимается **вместе с базовым** compose (иначе `postgres-exporter`
не находит сервис `postgres`):

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

| Сервис | Порт | Назначение | Auth |
|---|---|---|---|
| **Grafana** | 3000 | Дашборды | логин (см. ниже) |
| **Prometheus** | 9090 | Метрики, targets, алерты | ❌ нет |
| **Alertmanager** | 9093 | Маршрутизация алертов | ❌ нет |
| cAdvisor | 8081 | Метрики контейнеров | ❌ нет |
| node-exporter | 9100 | Метрики хоста (**не стартует на macOS**, см. ниже) | ❌ нет |
| postgres-exporter | 9187 | Метрики Postgres | ❌ нет |
| redis-exporter | 9121 | Метрики Redis | ❌ нет |

Открыть локально: `http://localhost:3000` (Grafana), `http://localhost:9090/targets`
(живы ли источники), `http://localhost:9090/alerts` (алерты).

- **Логин Grafana** — из env `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`; **по умолчанию
  `admin` / `admin`**. Обязательно задать сильный пароль перед любым выставлением наружу.
- **node-exporter на macOS не работает** — маунт `/:/host:ro,rslave` требует shared-mount,
  которого нет в Docker Desktop → алерт `InstanceDown` горит локально. На Linux-VPS
  запускается штатно.
- Правила алертов: `monitoring/prometheus/alerts.yml` (5 шт.: InstanceDown, HighCpu,
  HighMemory, PostgresDown, RedisDown). Проверить синтаксис:
  `docker run --rm --entrypoint promtool -v "$PWD/monitoring/prometheus":/p prom/prometheus:v2.54.1 check rules /p/alerts.yml`.

---

## E. Как открыть техническую часть в интернете — БЕЗОПАСНО

> 🔴 **Важно.** Сейчас порты мониторинга биндятся на `0.0.0.0` (`3000`, `9090`, `9093`,
> `8081`, `9100`, `9187`, `9121`). Prometheus, Alertmanager, cAdvisor и экспортёры **не
> имеют аутентификации вообще**, а Grafana по умолчанию `admin/admin`. Через nginx они
> **не проходят** (нет TLS/авторизации). Если файрвол VPS не закрывает эти порты — они уже
> доступны из интернета. Это ровно тот стек метрик инфраструктуры, который отдавать
> публично нельзя.

Правильный порядок, чтобы отдать наружу только то, что безопасно:

1. **Закрыть прямые порты на файрволе.** Открыты наружу должны быть только `80` и `443`:
   ```bash
   sudo ufw allow 80 && sudo ufw allow 443
   sudo ufw deny 3000 && sudo ufw deny 9090 && sudo ufw deny 9093 \
     && sudo ufw deny 8081 && sudo ufw deny 9100 && sudo ufw deny 9187 && sudo ufw deny 9121
   ```
   Ещё надёжнее — сменить биндинги в `docker-compose.monitoring.yml` на `127.0.0.1:PORT:PORT`,
   чтобы контейнеры вообще не слушали внешний интерфейс.

2. **Grafana — единственное, что стоит публиковать**, и только за TLS + сильным паролем:
   - задать `GRAFANA_ADMIN_PASSWORD` (не `admin`), выключить саморегистрацию;
   - поднять поддомен `grafana.citrinevault.ru`, выпустить сертификат Let's Encrypt;
   - проксировать nginx-ом на `grafana:3000` (по образцу `location /api/` в
     `frontend/nginx.prod.conf`), внутри — на `127.0.0.1:3000`.

3. **Prometheus / Alertmanager / cAdvisor / экспортёры — НЕ публиковать.** Доступ к ним —
   только через SSH-туннель (`ssh -L 9090:localhost:9090 user@vps`) или VPN. Если очень
   нужен веб-доступ — закрыть nginx basic-auth **и** TLS, отдельным поддоменом, но по
   умолчанию держать их внутренними.

4. **Swagger / SQLAdmin** (`/api/v1/docs`, `/admin`) уже идут через nginx приложения. `/admin`
   защищён паролем (`ET_ADMIN_PASSWORD`); Swagger в проде стоит закрывать или прятать за
   basic-auth, если не нужен публично.

Короткое правило: **наружу — только `443` приложения и, при желании, Grafana за TLS+паролем.
Всё остальное из таблицы D — внутрь, через туннель/VPN.**
