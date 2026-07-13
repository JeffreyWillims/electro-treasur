"""Юнит-тесты чистых хелперов api_key_service (без БД)."""

from __future__ import annotations

from src.services.api_key_service import (
    KEY_NAMESPACE,
    PREFIX_HEX_LEN,
    SECRET_HEX_LEN,
    extract_prefix,
    generate_plain_key,
)


def test_generate_plain_key_format() -> None:
    plain_key, prefix = generate_plain_key()
    assert plain_key.startswith(KEY_NAMESPACE)
    assert len(prefix) == PREFIX_HEX_LEN
    assert len(plain_key) == len(KEY_NAMESPACE) + PREFIX_HEX_LEN + SECRET_HEX_LEN
    assert extract_prefix(plain_key) == prefix


def test_generate_plain_key_unique() -> None:
    keys = {generate_plain_key()[0] for _ in range(50)}
    assert len(keys) == 50


def test_extract_prefix_rejects_garbage() -> None:
    assert extract_prefix("not-a-key") is None
    assert extract_prefix("cv_short") is None
    assert extract_prefix("") is None
    # Правильный namespace, но лишняя длина
    assert extract_prefix("cv_" + "a" * 41) is None
