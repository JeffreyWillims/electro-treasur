# Топ-инструкция: разработка фич без поломок

Как добавлять функциональность в Citrine Vault так, чтобы код не ломался сразу и был
покрыт тестами. Эталон — реальная фича **Bank Offers** (свежая, полная вертикаль):
модель `BankOffer` → миграция `87839f63308a` → схема `schemas/offer.py` → роутер
`api/v1/offers.py` → тесты `tests/integration/test_offers.py`. При сомнении в структуре —
открой эти пять файлов и повтори форму.

## Нулевое правило: зелёная база

Перед началом — убедись, что текущий набор зелёный:

```bash
cd backend && pytest tests/unit tests/integration -m "not e2e" -q
```

Если база красная — сначала почини или зафиксируй известные фейлы. Строить на красной базе
запрещено: не отличишь свою поломку от чужой.

## Вертикальный срез: порядок слоёв

Фича идёт снизу вверх, каждый слой закрывается тестом до перехода к следующему:

```
1. Контракт      Опиши API заранее: путь, метод, схемы запроса/ответа.
                 Сверь с docs/API_REFERENCE.md — не ломай существующие контракты.

2. Модель + БД   src/domain/models.py: NUMERIC(12,2) для денег, TIMESTAMPTZ, UNIQUE/FK
                 с ondelete. Коллекции с NOT NULL детьми — passive_deletes=True.
                 → alembic revision --autogenerate -m "..." и ПРОЧИТАЙ diff миграции
                 → тест на constraint в tests/integration/test_repositories.py-стиле

3. Схемы         src/schemas/<фича>.py: Pydantic v2, ConfigDict (не class Config),
                 Decimal с max_digits=12, decimal_places=2.
                 → юнит-тест валидации в стиле tests/unit/test_schemas.py

4. Сервис        src/services/<фича>_service.py: async-функции с AsyncSession.
                 Ретраябельные мутации — идемпотентность (Redis + UNIQUE, эталон
                 transaction_service.py). Медленное/внешнее (LLM, OCR) — в arq,
                 роутер отдаёт 202 + task_id (эталон insights.py).

5. Роутер        src/api/v1/<фича>.py: тонкий (валидация → один вызов сервиса →
                 HTTPException). Обязательно Depends(get_current_user) — включая
                 poll-эндпоинты! Абьюзабельное — @limiter.limit(...).
                 Подключи в api/v1/router.py.
                 → integration-тесты: happy path, 401, 404, граничные значения

6. Документация  docs/API_REFERENCE.md (+ DATABASE_SCHEMA.md при изменении БД),
                 tests/TESTING.md — новые тестовые файлы.
```

## Тестовый контур (обязательный)

- **Красный тест первым** для багфиксов; для фич — тест сразу после слоя.
- Уровень выбирается по пирамиде (см. `qa_agent.md`): чистая логика → unit
  (широкий вход → Hypothesis), эндпоинт/constraint → integration (SAVEPOINT-изоляция,
  фабрики через `.build()`), сквозной сценарий → e2e.
- Порог покрытия CI — 70%, текущее значение — на грани (~67% из-за telegram-модулей).
  **Новый код без тестов опускает планку ниже порога и валит CI** — тесты не опция.

## Финальный гейт (перед коммитом, порядок как в CI)

```bash
cd backend
ruff check . && ruff format --check .
mypy src/
pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-fail-under=70
```

Красный шаг = стоп и фикс, следующие шаги не смотрим (fail-fast — так же работает
`BackendAgent.verify()`).

## Чего не делать

- Не менять существующие ответы API без пометки в `docs/API_REFERENCE.md` — на них завязан
  `frontend/src/api/client.ts` (Decimal-строки, формат ошибок из `core/exceptions.py`).
- Не добавлять зависимость только в `requirements.txt` или только в `pyproject.toml` —
  всегда в оба (прецедент рассинхрона: argon2-cffi, см. `security_audit.md`).
- Не писать «на будущее»: абстракции для одного вызова, конфигурируемость без запроса —
  режутся на ревью (CLAUDE.md, Simplicity First).
- Не трогать чужие слои в одном диффе: правка модели + рефакторинг соседнего сервиса =
  два отдельных изменения.
