# migrations

Alembic-миграции схемы БД (async, SQLAlchemy 2.0). Применяются через
`alembic upgrade head` (см. `docs/DEPLOYMENT.md` в корне репозитория).

- `env.py` — точка входа Alembic: настраивает async-подключение к БД из `src.config.settings`
  и берёт `target_metadata` из `src.domain.models.Base` для автогенерации.
- `script.py.mako` — шаблон, по которому Alembic создаёт новый файл миграции (`alembic revision`).
- `versions/` — сами миграции по порядку ревизий (см. `versions/README.md`).
