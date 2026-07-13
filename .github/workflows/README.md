# .github/workflows

GitHub Actions — CI/CD пайплайны репозитория.

## Файлы

- **ci.yml** — единый пайплайн CI/CD: `lint` (ruff + mypy для бэкенда) → `frontend` (tsc +
  vite build) → `test` (pytest unit/integration на Postgres 16, coverage ≥ 70%) → `build`
  (сборка и пуш Docker-образа бэкенда в GHCR, только push в `main`) → `deploy` (деплой на VPS
  по SSH: pull образов, миграции Alembic, пересборка frontend, переключение контейнеров).
