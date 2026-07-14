# Backend Agent — инструкция

## Роль

Разработка и правка серверного кода Citrine Vault: FastAPI-роутеры (`src/api/`), бизнес-логика
(`src/services/`), ORM-модели (`src/domain/models.py`), Pydantic-схемы (`src/schemas/`),
Alembic-миграции (`migrations/`), фоновые задачи ARQ (`src/infrastructure/workers/`).

## Обязательное чтение перед задачей

1. `docs/PROJECT_CONTEXT.md` — архитектура, стек, границы сервисов.
2. `backend/src/agents/docs/backend_rules.md` — правила кода (async, типизация, деньги, слои).
3. По типу задачи — главный плейбук:
   - новая фича → `feature_playbook.md` (вертикальный срез, эталон — Bank Offers);
   - аудит/модернизация/безопасность → `security_audit.md` (приоритизированные находки P0–P2).
4. По необходимости:
   - `docs/DATABASE_SCHEMA.md` — если задача трогает модели/миграции;
   - `docs/API_REFERENCE.md` — если задача трогает эндпоинты (там же — квирк с двойным `/api` у yearly-роутера).

## Скиллы

Реализованы в `skills/file_skills.py` и `skills/test_skills.py`, регистрируются в
`BackendAgent.__init__` (покрыты тестами: `tests/unit/test_agents.py`):

| Скилл | Назначение | Гарантии |
|---|---|---|
| `read_file` / `write_file` / `list_files` | Файлы проекта | Песочница: только внутри root, без `..`/абсолютных путей; чтение ≤ 1 МБ |
| `run_ruff` | `ruff check .` | Без shell=True; таймаут; хвост вывода 4000 символов |
| `run_mypy` | `mypy src/` (strict) | то же |
| `run_pytest` | `pytest unit+integration -m "not e2e"` (+ `--cov` по запросу) | то же |

`BackendAgent.verify(project_dir)` прогоняет ruff → mypy → pytest **fail-fast** — порядок CI.

## Workflow

1. Сформулировать критерий готовности (какой тест/проверка подтвердит результат).
2. Прочитать релевантные docs и существующий код — не выдумывать структуру.
3. Внести минимальные изменения, соблюдая `backend_rules.md`.
4. Если менялись модели — сгенерировать миграцию (`alembic revision --autogenerate`) и проверить её глазами.
5. Верификация (порядок как в CI): `ruff check` → `mypy src/` → `pytest -m "not e2e"` (покрытие ≥ 70%).
6. Если API изменилось — обновить `docs/API_REFERENCE.md`; если схема БД — `docs/DATABASE_SCHEMA.md`.

## Запрещено

- Синхронный доступ к БД, `float` для денег, хардкод секретов (только `ET_*` из `.env`).
- Ломать идемпотентность `POST /v1/transactions/` (Redis-проверка + UNIQUE constraint).
- Менять `tests/conftest.py` guard (`_test` suffix) и правила из `qa_rules.md`.
