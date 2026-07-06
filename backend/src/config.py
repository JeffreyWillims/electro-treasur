"""
Electro-Treasur Configuration.

Centralized settings via pydantic-settings.
Environment variables override defaults → 12-Factor compliant.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide configuration loaded from environment / .env file."""

    # ── JWT Security ─────────────────────────────────────────────────────
    # No default — must be set via ET_SECRET_KEY env var. Fails fast on startup.
    secret_key: str
    algorithm: str = "HS256"
    refresh_token_expire_days: int = 7  # TTL refresh-токена в Redis
    # Secure-флаг cookie требует HTTPS; в проде True, в локальной/тестовой среде
    # (http) переопределяется через ET_COOKIE_SECURE=false, иначе браузер/клиент
    # не отправит cookie.
    cookie_secure: bool = True

    # ── PostgreSQL (via PgBouncer) ──────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://electro:electro_secret@localhost:5432/electro_treasur"
    )
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800  # seconds — PgBouncer compatible

    # ── Redis ───────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_idempotency_ttl: int = 86400  # 24 h

    # Хранилище счётчиков rate-limiter. Пусто → берётся redis_url (общие счётчики
    # для всех воркеров/реплик). Тесты переопределяют на "memory://" (без Redis).
    ratelimit_storage_uri: str = ""

    # ── arq Worker ──────────────────────────────────────────────────────
    arq_redis_url: str = "redis://localhost:6379/1"

    # ── Email / SMTP ────────────────────────────────────────────────────
    # Пустой host — письма уходят в структурный лог (поведение по умолчанию).
    # Локально: ET_SMTP_HOST=mailhog (см. docker-compose.yml), UI — :8025.
    smtp_host: str = ""
    smtp_port: int = 1025
    smtp_from: str = "noreply@citrine-vault.local"

    # ── Telegram Bot ─────────────────────────────────────────────────────
    telegram_bot_token: str = ""
    telegram_proxy_url: str | None = None

    # ── Admin Panel (SQLAdmin) ──────────────────────────────────────────
    # Login is disabled while admin_password is empty — set ET_ADMIN_PASSWORD to enable.
    admin_username: str = "admin"
    admin_password: str = ""

    model_config = {"env_prefix": "ET_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
