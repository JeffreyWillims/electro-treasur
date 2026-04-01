"""
Electro-Treasur Configuration.

Centralized settings via pydantic-settings.
Environment variables override defaults → 12-Factor compliant.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide configuration loaded from environment / .env file."""

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
    redis_insight_ttl: int = 86400  # 24 h
    redis_idempotency_ttl: int = 86400  # 24 h

    # ── arq Worker ──────────────────────────────────────────────────────
    arq_redis_url: str = "redis://localhost:6379/1"

    model_config = {"env_prefix": "ET_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
