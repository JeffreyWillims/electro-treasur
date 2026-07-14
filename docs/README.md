# Документация проекта

Оглавление файлов в этой папке (содержимое самих файлов не менялось):

- **[API_REFERENCE.md](API_REFERENCE.md)** — справочник по API: устройство роутеров бэкенда
  (`v1_router`, `analytics_router`) и их префиксы путей.
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** — схема базы данных: таблицы SQLAlchemy-моделей
  (`backend/src/domain/models.py`) и Alembic-миграции.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — деплой и CI/CD: переменные окружения (префикс `ET_`) и
  процесс выката.
- **[INCIDENTS.md](INCIDENTS.md)** — журнал инцидентов проекта (что случилось, как исправлено).
- **[KONSPEKT.md](KONSPEKT.md)** — учебный конспект владельца проекта: разбор собственного
  фреймворка «от запроса до пикселя» и смоук-чеклист тестировщика.
- **[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)** — общее описание проекта Citrine Vault:
  персональный финансовый трекер с ИИ-ассистентом (веб + Telegram-бот на общем FastAPI-бэкенде).
- **[frontend_migration.md](frontend_migration.md)** — миграция авторизации фронтенда с JWT в
  `localStorage` на `httpOnly`-куки.
- **[habr_article.md](habr_article.md)** — черновик статьи для Хабра о финтех-трекере, где
  ключевое решение — не использовать LLM.
