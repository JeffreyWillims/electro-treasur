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
