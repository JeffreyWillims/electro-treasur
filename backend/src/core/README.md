# core

Сквозная инфраструктура FastAPI-приложения: обработка ошибок и ограничение частоты запросов, не привязанные к конкретному домену.

- `exceptions.py` — `setup_exception_handlers()` регистрирует глобальные обработчики исключений (Exception, HTTPException, RequestValidationError), возвращающие клиенту очищенный JSON-ответ и логирующие полный traceback с уникальным `error_id`.
- `rate_limit.py` — единый экземпляр `limiter` (SlowAPI) с ключевой функцией `get_remote_address`, хранилищем счётчиков в Redis (или in-memory fallback) для использования в `main.py` и роутах `auth.py`.
