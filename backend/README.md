# backend

FastAPI-бэкенд Citrine Vault (Python 3.12, SQLAlchemy 2.0 async, PostgreSQL, arq).

- `Dockerfile` — мультистейдж-сборка: builder (компиляция C-расширений) → тонкий runtime-образ.
- `alembic.ini` — конфигурация Alembic (пути миграций, URL БД из окружения).
- `pyproject.toml` — зависимости и настройки инструментов (ruff, mypy strict, pytest).
- `requirements.txt` — зафиксированные версии зависимостей (сгенерирован из `pyproject.toml`).
- `run_arq.py` — лаунчер arq-воркера, совместимый с Python 3.14+ (создаёт `Worker`
  внутри async-контекста в обход `asyncio.get_event_loop()`, удалённого в 3.14).
- `src/` — исходный код приложения, см. `src/README.md`.
- `migrations/` — Alembic-миграции схемы БД, см. `migrations/README.md`.
- `tests/` — тесты (unit/integration/e2e), см. `tests/README.md`.
- `scripts/` — вспомогательные скрипты, см. `scripts/README.md`.
