# Топ-инструкция: аудит и модернизация backend-кода (безопасность)

Для любого агента/разработчика, выполняющего анализ или модернизацию `backend/src/`.
Все пункты ниже — из **реального аудита кодовой базы** (2026-07-04), не абстрактный чек-лист.

## Принцип

Чинить корень, а не симптом. Два кейса этой кодовой базы как эталон подхода:

1. **500 на логине**: dummy-хэш был в формате bcrypt при argon2-верификаторе. Неправильный фикс —
   «поймать исключение»: он убил бы timing-attack защиту. Правильный — валидный argon2-хэш
   (`auth_service.DUMMY_PASSWORD_HASH`), чтобы холостое вычисление реально выполнялось.
2. **ORM-каскады**: `NotNullViolationError` при `session.delete()`. Неправильный фикс — ловить
   ошибку в сервисе. Правильный — `passive_deletes=True`, чтобы ORM доверял `ON DELETE CASCADE` БД.

Каждый фикс безопасности начинается с красного теста-репродьюсера и заканчивается зелёным.

## Открытые находки (проверены по коду, приоритизированы)

### P0 — исправить в первую очередь

| Находка | Где | Что делать |
|---|---|---|
| ✅ **[ИСПРАВЛЕНО 2026-07-04] Poll-эндпоинты без аутентификации** — `GET /v1/insights/{task_id}` и `GET /api/analytics/tasks/{task_id}` читались без JWT | `src/api/v1/insights.py::poll_insight`, `src/api/analytics/yearly.py::poll_yearly_task` | Добавлен `Depends(get_current_user)`; ownership-проверка `info.args[0] == current_user.id`, иначе 404 (чужая/несуществующая задача неотличимы). Тесты: `tests/integration/test_security_p0.py` (401 без токена, 404 на чужую, 200 pending на свою) |
| ✅ **[ИСПРАВЛЕНО 2026-07-04] `argon2-cffi` отсутствовал в `pyproject.toml`** — был только в `requirements.txt`; `pip install .` дал бы `ImportError` в `auth_service` → аутентификация мертва | `backend/pyproject.toml` | Добавлен `argon2-cffi>=23.1.0`. Заодно синхронизированы ещё 8 реально используемых, но не задекларированных рантайм-зависимостей (см. ниже). Smoke-тест: `tests/unit/test_auth_dependency.py` |

### P1 — модернизация, короткий горизонт

| Находка | Где | Что делать |
|---|---|---|
| ✅ **[ИСПРАВЛЕНО 2026-07-04] Мёртвые зависимости**: `passlib[bcrypt]`, транзитивный `bcrypt` и `types-passlib` не использовались (всё на argon2) | `pyproject.toml`, `requirements.txt` | Удалены из обоих манифестов + dev-stubs. `auth_service.py` уже на чистом argon2-cffi — прослойки passlib больше нет. `pip-audit` чище на 2 пакета |
| ✅ **[ИСПРАВЛЕНО 2026-07-04] JWT без refresh/отзыва**: был только access-токен, TTL 24ч, без возможности отзыва | `src/services/auth_service.py`, `src/api/v1/auth.py`, `src/infrastructure/redis_client.py` | Access TTL снижен до **15 мин**; реализован **Refresh Token Rotation** — refresh хранится ТОЛЬКО в Redis (не в JWT), при обмене старый мгновенно отзывается; эндпоинты `POST /refresh` и `POST /logout`. Тесты: `tests/integration/test_jwt_refresh.py`. **Остаётся** (не в этом спринте): алгоритм всё ещё HS256 (не RS256), фронтенд хранит access в localStorage — перенос в httpOnly cookie отдельной задачей |
| ✅ **[ИСПРАВЛЕНО (backend) 2026-07-04] JWT в localStorage** — уязвим к XSS | `src/api/v1/auth.py`, `src/dependencies.py` | Токены переведены на `httpOnly`+`Secure`+`SameSite=lax` cookie: login/refresh ставят cookie (не тело), `get_current_user` читает `access_token` из cookie. Тесты: `tests/integration/test_jwt_refresh.py` (проверяют HttpOnly и отсутствие токенов в теле). **Остаётся**: мигрировать фронтенд (`credentials: 'include'`, убрать Bearer — см. `docs/frontend_migration.md`); CSRF-токен для мутаций; RS256 |
| **`/admin` (SQLAdmin) доступен через публичный nginx** | `frontend/nginx*.conf`, `src/admin.py` | Проверить аутентификацию SQLAdmin; добавить IP-allowlist или basic-auth на уровне nginx; rate-limit |
| **Логи через `print` + `datetime.utcnow()` (deprecated), `user_id: "anonymous"` всегда** | `src/main.py::json_log_middleware` | Перейти на `logging` + `datetime.now(UTC)`; прокидывать реальный user_id — без него инциденты не расследуются |

### P2 — план

| Находка | Где | Что делать |
|---|---|---|
| Rate-limit только на register/login/OTP; тяжёлый `/transactions/import` (OCR/парсинг) не ограничен | `src/api/v1/transactions.py` | `@limiter.limit(...)` на import и enqueue-эндпоинты LLM |
| `src/infrastructure/telegram/*` — ~340 строк с покрытием 0–29%, при этом бот принимает пользовательский ввод | `handlers.py`, `middleware.py`, `bot.py` | Юнит-тесты на парсинг ввода (паттерн уже есть: `test_telegram_helpers.py`) |
| Pydantic class-based `Config` (deprecated) в `schemas/user.py` | `src/schemas/user.py:23,37` | Заменить на `ConfigDict` — уйдут warnings, готовность к Pydantic v3 |

## Аудит 2026-07-22 (пред-деплойный, 3 read-only агента: backend / frontend / infra)

Второй сквозной проход перед первой боевой выкаткой. Находки проверены вручную,
сгруппированы по влиянию на деплой. Первоисточник — `docs/WORKLOG.md` (запись 2026-07-22).
Статусы обновляются по мере починки: пусто → в работе, ✅ → исправлено и покрыто.

### P0 — блокеры деплоя (прямое влияние на выкатку)

| Находка | Где | Что делать |
|---|---|---|
| ✅ **[ИСПРАВЛЕНО 2026-07-27] nginx stale-DNS → 502** — `proxy_pass http://backend:8000` без `resolver`: nginx резолвит `backend` один раз на старте, при пересоздании контейнера (deploy) IP меняется → 502 на весь API до перезапуска nginx | `frontend/nginx.prod.conf` | Добавлен `resolver 127.0.0.11 valid=10s` (Docker DNS) + upstream в переменную, чтобы имя перечитывалось в рантайме |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] nginx: нет no-cache для `sw.js`/`registerSW.js`/`manifest.webmanifest`/`index.html`** — installed-PWA отдаёт старый код после деплоя (stale service worker, хуже обычного stale-кэша) | `frontend/nginx.prod.conf`, `frontend/vite.config.ts` | `Cache-Control: no-cache` на `sw.js`/`registerSW.js`/`manifest.webmanifest` и на оболочку (`location /`); ассеты с хешем (`/assets/`) остаются `immutable` |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] App.tsx: month-end баг** — на 31-х числах дефолтный период дашборда залезает на 2 месяца (`setMonth` переполняется: 31 июня → 1 июля) → неверные суммы доход/расход/баланс | `frontend/src/App.tsx:54-59` | `setDate(1)` перед `setMonth`, затем `setDate(0)` — последний день текущего месяца без переполнения |

### P1 — надёжность / безопасность (код)

| Находка | Где | Что делать |
|---|---|---|
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Импорт-эндпоинты без rate-limit** — `/imports/statement` и `/transactions/import` дёргают ARQ-воркер (OCR/парсинг) без ограничений → DoS воркера | `src/api/v1/imports.py`, `src/api/v1/transactions.py` | `@limiter.limit("10/minute")` + `request: Request` на оба (закрывает и P2-находку аудита 2026-07-04) |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Idempotency-дубль без `category_name`** — ни ветка дубля, ни свежий INSERT не проставляли `category_name` (в отличие от list/update) → пустая категория в ответе | `src/services/transaction_service.py` | `_ensure_category_owned` теперь возвращает имя категории; `create_transaction` заполняет `category_name` на обоих путях (INSERT и дубль) |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Сырой `errorBody.detail` в тостах** — на 422 (ошибки импорта) объект попадает в UI как «[object Object]»; повторный 401 не редиректил на логин | `frontend/src/api/client.ts` | Все прямые `apiFetch`-пути (import/upload/export/delete) прогнаны через `humanizeDetail`; в `apiFetch` повторный 401 (после неудачного retry) теперь тоже редиректит на `/login` |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] QuickEntry без Idempotency-Key** — ручное сохранение транзакции без ключа → редкие дубли при ретраях | `frontend/src/components/dashboard/QuickEntry.tsx` | `crypto.randomUUID()` генерируется один раз на сабмит и прокидывается в `createTransaction`; ретрай не плодит дубли |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] SSE `JSON.parse` без try/catch** — битый/частичный/keepalive-кадр вешает импорт на ~90% | `frontend/src/components/dashboard/StatementImportModal.tsx` | `es.onmessage` оборачивает парс в try/catch, битый кадр пропускается (`return`) |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] `/admin/login` без rate-limit** — брутфорс пароля SQLAdmin | `src/admin.py` | `AdminAuth.login` — не route (декоратор не годится): ручной Redis-счётчик 5 попыток/60с на IP, fail-open при недоступном Redis, успешный вход обнуляет счётчик |

### P2 — производительность / масштабируемость

| Находка | Где | Что делать |
|---|---|---|
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Синхронный парс PDF в async** — блокирует все 10 job воркера | `src/services/ai_vision_service.py` | Разбор pdfplumber вынесен в `_extract_text_from_pdf` + `asyncio.to_thread` (как Excel/OCR-пути рядом) |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Крон seq scan** — `func.date(executed_at)` без `user_id` в `get_active_user_ids` → seq scan всей таблицы + сортировка под distinct | `src/services/cashflow_prep.py` | Полуоткрытый диапазон `executed_at >= start AND < end+1day` (sargable, использует b-tree; уходит и зависимость от серверной TZ) |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Свой engine без PgBouncer-args** — `statement_cache_size=0` не задан → «prepared statement does not exist» на проде; engine не закрывается | `src/infrastructure/workers/insight_scheduler.py` | `startup` переиспользует общий `engine` из `src.database` (уже с PgBouncer-args); `shutdown` вызывает `engine.dispose()` |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Колокольчик: 5 upsert на каждый опрос** — 5 round-trip'ов + WAL-churn на любое открытие ленты | `src/api/v1/notifications.py` | Один батч-`pg_insert(...).values([...])` с `ON CONFLICT DO NOTHING` вместо цикла, один commit |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Offset без верхней границы** — deep-pagination O(offset) | `src/api/v1/transactions.py` | `offset: int = Query(0, ge=0, le=100_000)` — верхняя граница отсекает patho-offset (keyset — отдельная задача) |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] `func.date` в TZ сервера** — если Postgres не UTC, траты попадают в чужой день | `src/services/dashboard_service.py` | День бакетится в явном UTC: `func.date(func.timezone('UTC', executed_at))` в SELECT+GROUP BY (executed_at — timestamptz); совпадает с UTC-границами WHERE, day-guard оставлен подстраховкой |
| ✅ **[ИСПРАВЛЕНО 2026-07-27] Currency-селектор без конвертации** — USD/EUR складывались в сумму как RUB | `frontend/src/components/dashboard/QuickEntry.tsx` | Запрет смешения: селектор ограничен `['RUB']` до появления FX-курсов (полноценная конвертация — отдельная фича) |

### Инфра — требует решения владельца (не правится агентом молча)

Мониторинг на `0.0.0.0` + Grafana `admin/admin`; пароль БД `electro_secret` в git и нет TLS до БД;
нет mem/cpu-лимитов (OOM-риск на одном VPS); нет security-заголовков (HSTS/CSP), `real_ip` для
Cloudflare, `limit_req` на `/api`; pgbouncer без healthcheck; CI деплой на `:latest` без
rollback/бэкапа до миграции. Вынесено владельцу — см. `docs/WORKLOG.md`.

## Регламент аудита (повторяемый)

```bash
# 1. Зависимости: CVE + рассинхрон pyproject/requirements
pip-audit --desc -r backend/requirements.txt
diff <(грep -оЕ '^[a-z0-9-]+' backend/requirements.txt | sort -u) — сверить с pyproject вручную

# 2. Эндпоинты без аутентификации (каждое совпадение объяснить или закрыть)
grep -rn "async def" backend/src/api --include="*.py" -A5 | grep -B3 -L "get_current_user"

# 3. Секреты в коде (должно быть пусто — всё через ET_* из .env)
grep -rn "secret\|password\|token" backend/src --include="*.py" | grep -v "settings\.\|env\|Field\|schema"

# 4. Статика + типы + тесты — обязательный финал любого фикса
cd backend && ruff check . && mypy src/ && pytest tests/unit tests/integration -m "not e2e"
```

Инварианты, которые нельзя ослаблять ни при какой модернизации: Redis+UNIQUE идемпотентность
транзакций, timing-safe логин, `NUMERIC(12,2)`/`Decimal` для денег, `_test`-guard в conftest,
non-root Docker, `ET_*`-конфигурация без хардкода.
