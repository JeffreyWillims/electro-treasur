"""
Конфигурация Electro-Treasur.

Централизованные настройки через pydantic-settings.
Переменные окружения переопределяют значения по умолчанию → соответствие 12-Factor.
"""

from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Общая конфигурация приложения, загружаемая из окружения / .env файла."""

    # ── Окружение ────────────────────────────────────────────────────────
    # В "prod" включаются инварианты ниже: приложение откажется стартовать
    # с дефолтным CORS, коротким секретом или cookie без Secure.
    environment: Literal["local", "staging", "prod"] = "local"

    # Origin'ы фронтенда для CORS — через запятую.
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

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

    # ── Redis ────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    redis_idempotency_ttl: int = 86400  # 24 часа

    # Хранилище счётчиков rate-limiter. Пусто → берётся redis_url (общие счётчики
    # для всех воркеров/реплик). Тесты переопределяют на "memory://" (без Redis).
    ratelimit_storage_uri: str = ""

    # ── Воркер arq ──────────────────────────────────────────────────────
    arq_redis_url: str = "redis://localhost:6379/1"

    # ── Обратная связь ───────────────────────────────────────────────────
    # Кто видит окно «Обратная связь» (список email через запятую). Пусто —
    # доступ закрыт для всех, тот же принцип, что и у admin_password ниже.
    feedback_admin_emails: str = ""

    # ── Telegram-бот ─────────────────────────────────────────────────────
    telegram_bot_token: str = ""
    telegram_proxy_url: str | None = None

    # ── Админ-панель (SQLAdmin) ──────────────────────────────────────────
    # Вход отключён, пока admin_password пуст — задайте ET_ADMIN_PASSWORD для включения.
    admin_username: str = "admin"
    admin_password: str = ""

    model_config = {"env_prefix": "ET_", "env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        """CORS-origin'ы списком (пустые элементы отбрасываются)."""
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @model_validator(mode="after")
    def _check_prod_invariants(self) -> "Settings":
        """Прод не должен стартовать с небезопасными настройками.

        Раньше такие ошибки обнаруживались уже в бою: дефолтный localhost-CORS
        или cookie без Secure никак себя не проявляли до инцидента.
        """
        if self.environment != "prod":
            return self

        problems: list[str] = []
        if len(self.secret_key) < 32:
            problems.append("ET_SECRET_KEY короче 32 символов")
        if not self.cookie_secure:
            problems.append("ET_COOKIE_SECURE=false — cookie уйдёт по http")
        if not self.cors_origin_list:
            problems.append("ET_CORS_ORIGINS пуст")
        if any("localhost" in origin for origin in self.cors_origin_list):
            problems.append("ET_CORS_ORIGINS содержит localhost")
        if problems:
            raise ValueError("Небезопасная конфигурация прода: " + "; ".join(problems))
        return self


settings = Settings()
