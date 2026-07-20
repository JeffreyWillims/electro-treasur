# 🎯 Тесты: текущее состояние и план усиления

> Замер: **2026-07-20**, полный прогон `tests/unit + tests/integration -m "not e2e"`
> против эфемерного PostgreSQL 16 (`--cov=src --cov-report=term-missing`).

---

## 📊 Текущее состояние

| Показатель | Значение |
|---|---|
| **Тестов прогнано** | 481 |
| **Прошло / упало** | 481 passed / **0 failed**, 5 warnings |
| **Время прогона** | ~31 сек (с покрытием) |
| **Покрытие `src/`** | **75%** (3630 строк, 897 непокрыто) |
| **ruff check src tests** | ✅ All checks passed |
| **mypy src** | ✅ Success: no issues found in 94 source files |
| **Фронтенд-тесты** | ❌ **отсутствуют полностью** — в `frontend/package.json` нет ни `test`-скрипта, ни runner'а |
| **Фронтенд build** | ✅ `tsc -b && vite build` — успешно (2.3 с) |
| **Фронтенд eslint** | ⚠️ **13 ошибок** (`react-hooks/set-state-in-effect`, `react-hooks/refs`) |

Порог покрытия в CI — `--cov-fail-under=70`; фактические **75%** его проходят,
но запас всего 5 п.п. и держится он на «дешёвых» схемах Pydantic (100%), а не на бизнес-логике.

---

## 🕳 Слабые места

Модули с бизнес-логикой и низким покрытием (схемы и `__init__` исключены).

| Модуль | Покрытие | Чем рискуем |
|---|---|---|
| `src/infrastructure/telegram/bot.py` | **0%** | Бот вообще не инстанцируется в тестах: сломанный роутер/токен/polling обнаружится только в проде |
| `src/infrastructure/telegram/middleware.py` | **0%** | Middleware авторизации/сессии — регресс пропустит чужого пользователя в чужие данные молча |
| `src/services/dashboard_service.py` | **22%** | Главный экран. Ошибка в агрегатах (суммы, day-векторы, деление на ноль) даст неверные цифры без падения |
| `src/infrastructure/telegram/handlers.py` | **27%** | 418 строк, 304 непокрыты. Основной пользовательский канал: FSM-состояния, парсинг сумм, ветки ошибок |
| `src/infrastructure/telegram/notifier.py` | **35%** | Отправка напоминаний: тихий проглоченный exception = пользователь не получает уведомления |
| `src/services/transaction_service.py` | **41%** | Ядро домена: create/update/delete, идемпотентность, автокатегоризация, права владельца |
| `src/services/budget_service.py` | **42%** | Расчёт бюджета vs факт; overflow и границы месяца не проверены |
| `src/api/v1/consultant.py` | **46%** | LLM-эндпоинт: нет тестов на таймаут/ошибку провайдера/пустой ответ — 500 вместо деградации |
| `src/api/v1/api_keys.py` | **57%** | Выдача/отзыв ключей — security-поверхность, ветки 403/404 не покрыты |
| `src/api/v2/public.py` | **60%** | Публичный API: контракт наружу может незаметно измениться |
| `src/api/v1/insights.py` | **64%** | Ветки «нет инсайта», ошибки генерации, права доступа |
| `src/api/v1/transactions.py` | **65%** | Строки 126–156 — фильтры/пагинация/массовые операции без покрытия |
| `src/infrastructure/workers/insight_worker.py` | **67%** | Фоновый LLM-воркер: ретраи и обработка сбоя провайдера не тестируются |
| `src/services/health_score_service.py` | **67%** | Формула скоринга: сдвиг весов не поймать без golden-тестов |

---

## ✅ Что добавить

### P0 — критично (домен, деньги, доступ)

1. **`tests/unit/test_dashboard_service.py`** → `src/services/dashboard_service.py` (22%).
   Fake-репозиторий (паттерн уже есть в `test_services.py`), проверять: агрегаты за месяц,
   пустой период (нет деления на ноль), транзакции на границах месяца, корректность day-вектора
   по длине месяца (28/29/30/31), смешанные income/expense.

2. **`tests/integration/test_transaction_service.py`** → `src/services/transaction_service.py` (41%).
   Проверять: повторный `idempotency_key` не создаёт дубль; update чужой транзакции → 404/403,
   а не тихое изменение; delete несуществующей; автокатегоризация при отсутствии категории;
   NUMERIC(12,2) округление сумм.

3. **`tests/integration/test_api_keys.py`** → `src/api/v1/api_keys.py` (57%).
   Проверять: ключ показывается один раз, в БД лежит хэш; чужой ключ не отзывается (403/404);
   отозванный ключ не аутентифицирует; список не отдаёт секрет.

4. **`tests/unit/test_telegram_middleware.py`** → `src/infrastructure/telegram/middleware.py` (0%).
   Фейковые `event`/`data`/`handler`: неизвестный chat_id не попадает к хендлеру;
   в `data` кладётся правильный пользователь; исключение внутри хендлера не роняет middleware.

### P1 — важно (регрессии видны пользователю)

5. **`tests/unit/test_budget_service.py`** → `src/services/budget_service.py` (42%).
   Upsert того же месяца обновляет, а не дублирует; бюджет = 0; факт > бюджета (флаг overflow);
   категория без бюджета не ломает агрегат.

6. **`tests/integration/test_consultant.py`** → `src/api/v1/consultant.py` (46%).
   Замокать LLM-клиент: таймаут → 503/понятная ошибка, а не 500; пустой ответ провайдера;
   неавторизованный запрос → 401; rate-limit ветка.

7. **`tests/unit/test_health_score.py` (расширить)** → `src/services/health_score_service.py` (67%).
   Golden-тесты: 3–4 зафиксированных профиля пользователя → ожидаемый балл ± допуск.
   Ловит незаметный сдвиг весов формулы.

8. **`tests/unit/test_insight_worker.py`** → `src/infrastructure/workers/insight_worker.py` (67%),
   строки 104–122 и 231–254. Fail провайдера → джоба не падает молча, статус пишется;
   повторный запуск за тот же период идемпотентен.

### P2 — полезно

9. **`tests/integration/test_public_api_contract.py`** → `src/api/v2/public.py` (60%).
   Snapshot-тест JSON-контракта (набор ключей и типов) — ловит случайные breaking changes наружу.

10. **`tests/unit/test_telegram_handlers_flows.py`** → `handlers.py` (27%).
    Не гнаться за 100%: вынести и покрыть ветки парсинга ввода суммы/категории и текста ошибок
    (строки 642–802 — самый крупный непокрытый блок).

11. **`tests/unit/test_notifier.py`** → `notifier.py` (35%).
    Ошибка Telegram API логируется и не пробрасывается наружу воркера; текст сообщения
    соответствует тону из `test_reminder_copy.py`.

---

## 🛠 Инфраструктура тестов

### Порог покрытия

- Поднять `--cov-fail-under` с **70 → 75** прямо сейчас (текущее значение достигнуто),
  затем ступенчато до 80 по мере закрытия P0/P1.
- Вынести флаг в `pyproject.toml` не в `addopts` (это уже ломало подмножества прогонов),
  а в отдельный скрипт/`make test-ci`, чтобы локально и в CI была одна команда.
- Добавить `[tool.coverage.run] omit` для заведомо нетестируемого (`src/data/tax_seed.py`,
  `src/schemas/token.py`) — сейчас они дают ложные 0% и размывают картину.
- Рассмотреть `--cov-fail-under` по диффу (`diff-cover`): новый код обязан быть покрыт на 90%,
  даже если общий процент растёт медленно.

### Фронтенд

- Добавить **vitest + @testing-library/react** и скрипт `"test": "vitest run"`.
  Первые цели: `src/api/client.ts` (обработка 401/refresh), `FeedbackWidget.tsx`,
  `FeedbackInbox.tsx`, форматтеры сумм и дат.
- Локального Node нет — прогон через тот же docker-образ `node:20-alpine`,
  что и `npm run build`; добавить job в CI.
- **Починить 13 ошибок eslint** (`react-hooks/set-state-in-effect` в `GlassDateRangePicker.tsx`,
  `react-hooks/refs` в `PacificRide.tsx`) и включить `eslint` в CI как блокирующий шаг —
  сейчас он не запускается автоматически.

### Фикстуры

- Вынести в `tests/conftest.py` фикстуру `fake_llm` (замоканный клиент LLM) — сейчас каждый
  тест инсайтов/консультанта мокает по-своему.
- Фабрики: добавить `InsightFactory`, `BudgetFactory`, `GoalFactory` в `tests/factories/`
  по образцу существующих — сократит бойлерплейт в новых integration-тестах.
- Фикстура `second_user` + `second_auth_headers` — нужна почти во всех тестах на права доступа
  (P0 #2, #3), сейчас каждый тест создаёт второго пользователя вручную.

### Ускорение прогона

- 31 сек уже приемлемо, но при росте integration-набора: `pytest-xdist` (`-n auto`)
  с отдельной БД на воркер, либо `--dist loadfile` при общем PG.
- Разделить маркерами: `-m "not slow"` для быстрого локального цикла (unit ~5 с),
  полный набор — на pre-push/CI.
- Кэшировать образ PostgreSQL и слой pip в CI — сейчас основное время уходит на подъём окружения,
  а не на сами тесты.
