"""
Конфигурация Electro-Treasur.

Централизованные настройки через pydantic-settings.
Переменные окружения переопределяют значения по умолчанию → соответствие 12-Factor.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Общая конфигурация приложения, загружаемая из окружения / .env файла."""

    # ── Безопасность JWT ─────────────────────────────────────────────────
    # Значения по умолчанию нет — должен быть задан через ET_SECRET_KEY. Иначе быстрый фейл при старте.
    secret_key: str
    algorithm: str = "HS256"
    refresh_token_expire_days: int = 7  # TTL refresh-токена в Redis
    # Secure-флаг cookie требует HTTPS; в проде True, в локальной/тестовой среде
    # (http) переопределяется через ET_COOKIE_SECURE=false, иначе браузер/клиент
    # не отправит cookie.
    cookie_secure: bool = True

    # ── PostgreSQL (через PgBouncer) ──────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://electro:electro_secret@localhost:5432/electro_treasur"
    )
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800  # секунд — совместимо с PgBouncer

    # ── Redis ───────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_idempotency_ttl: int = 86400  # 24 часа

    # Хранилище счётчиков rate-limiter. Пусто → берётся redis_url (общие счётчики
    # для всех воркеров/реплик). Тесты переопределяют на "memory://" (без Redis).
    ratelimit_storage_uri: str = ""

    # ── Воркер arq ──────────────────────────────────────────────────────
    arq_redis_url: str = "redis://localhost:6379/1"

    # ── Email / SMTP ────────────────────────────────────────────────────
    # Пустой host — письма уходят в структурный лог (поведение по умолчанию).
    # Локально: ET_SMTP_HOST=mailhog (см. docker-compose.yml), UI — :8025.
    smtp_host: str = ""
    smtp_port: int = 1025
    smtp_from: str = "noreply@citrine-vault.local"

    # ── Telegram-бот ─────────────────────────────────────────────────────
    telegram_bot_token: str = ""
    telegram_proxy_url: str | None = None

    # ── Админ-панель (SQLAdmin) ──────────────────────────────────────────
    # Вход отключён, пока admin_password пуст — задайте ET_ADMIN_PASSWORD для включения.
    admin_username: str = "admin"
    admin_password: str = ""

    model_config = {"env_prefix": "ET_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
