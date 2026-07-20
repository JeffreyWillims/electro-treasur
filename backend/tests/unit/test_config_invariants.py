"""
tests/unit/test_config_invariants.py — прод-инварианты конфигурации.

Раньше приложение спокойно стартовало в бою с CORS на localhost и cookie без
Secure: такие настройки никак себя не проявляли до инцидента. Теперь Settings
c environment="prod" не собирается, если конфигурация небезопасна.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.config import Settings

STRONG_SECRET = "x" * 32
PROD_ORIGINS = "https://citrinevault.ru,https://www.citrinevault.ru"


def _settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "environment": "prod",
        "secret_key": STRONG_SECRET,
        "cookie_secure": True,
        "cors_origins": PROD_ORIGINS,
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_valid_prod_config_builds() -> None:
    settings = _settings()
    assert settings.environment == "prod"
    assert settings.cors_origin_list == [
        "https://citrinevault.ru",
        "https://www.citrinevault.ru",
    ]


def test_prod_rejects_short_secret() -> None:
    with pytest.raises(ValidationError, match="ET_SECRET_KEY"):
        _settings(secret_key="слишком-коротко")


def test_prod_rejects_insecure_cookie() -> None:
    with pytest.raises(ValidationError, match="ET_COOKIE_SECURE"):
        _settings(cookie_secure=False)


def test_prod_rejects_empty_cors() -> None:
    with pytest.raises(ValidationError, match="ET_CORS_ORIGINS пуст"):
        _settings(cors_origins="  ,  ")


def test_prod_rejects_localhost_cors() -> None:
    """Именно этот дефолт и был захардкожен в main.py до правки."""
    with pytest.raises(ValidationError, match="localhost"):
        _settings(cors_origins="http://localhost:5173")


def test_local_environment_allows_relaxed_settings() -> None:
    """Локальная разработка не должна страдать от прод-требований."""
    settings = Settings(
        environment="local",
        secret_key="short",
        cookie_secure=False,
        cors_origins="http://localhost:5173",
    )  # type: ignore[arg-type]
    assert settings.cors_origin_list == ["http://localhost:5173"]


def test_cors_origin_list_trims_and_drops_empties() -> None:
    settings = Settings(
        environment="local",
        secret_key="short",
        cors_origins=" https://a.ru , , https://b.ru ",
    )  # type: ignore[arg-type]
    assert settings.cors_origin_list == ["https://a.ru", "https://b.ru"]
