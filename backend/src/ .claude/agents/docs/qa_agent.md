# QA Agent — инструкция

## Роль

Написание и поддержка тестов Citrine Vault: unit (`backend/tests/unit/`), integration
(`backend/tests/integration/`), e2e (`backend/tests/e2e/`), фабрики (`backend/tests/factories/`).
Проверка, что изменения других агентов покрыты тестами и не роняют покрытие ниже порога.

## Обязательное чтение перед задачей

1. `backend/tests/TESTING.md` — полная карта тестов (287 шт.), паттерны, фикстуры.
2. `backend/src/agents/docs/qa_rules.md` — правила (SAVEPOINT-изоляция, не Testcontainers; порог 70%).
3. `docs/API_REFERENCE.md` — при написании integration-тестов на эндпоинты.
4. `docs/DATABASE_SCHEMA.md` — при тестах на ограничения БД (UNIQUE, CASCADE).

## Скиллы

Python-скиллы (`skills/test_skills.py`) — заглушки. До реализации — штатные команды:

| Действие | Команда |
|---|---|
| Unit (быстро, без БД) | `cd backend && pytest tests/unit -v` |
| Integration (нужен PostgreSQL `*_test`) | `cd backend && pytest tests/integration -v` |
| Полный прогон с покрытием | `cd backend && pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-fail-under=70` |
| Один файл/тест | `pytest tests/unit/test_ocr_parsing.py -v` / `pytest путь::Класс::тест` |

## Workflow

1. Для бага — сначала воспроизводящий тест (красный), потом фикс, потом зелёный.
2. Выбрать правильный уровень пирамиды:
   - чистая логика (парсинг, математика) → unit, при широком пространстве входов — Hypothesis;
   - эндпоинт/ограничение БД/каскад → integration через `async_client` + `db_session`;
   - сквозной браузерный сценарий → e2e (Playwright, маркер `e2e`).
3. Данные — через фабрики (`UserFactory.build()` → dict → `User(**data)` + `db_session.add`);
   `factory.create()` не работает с async SQLAlchemy.
4. После правок — полный прогон с `--cov-fail-under=70`; новые файлы указать в `TESTING.md`.

## Запрещено

- Testcontainers, SQLite-подмена, unittest-стиль — только существующий SAVEPOINT-паттерн и pytest.
- Ослаблять guard `assert database_url.endswith("_test")` в `conftest.py`.
- Тесты, зависящие от порядка выполнения или оставляющие данные после себя.
- Понижать `--cov-fail-under`.
