"""
tests/unit/test_auth_dependency.py — Smoke-тест: argon2-cffi подхвачен корректно.

Подтверждает, что после синхронизации манифестов (argon2-cffi в pyproject.toml,
passlib удалён) хеширование/проверка паролей работают на чистом Argon2. Без БД.
"""

from __future__ import annotations

from src.services.auth_service import (
    DUMMY_PASSWORD_HASH,
    get_password_hash,
    verify_password,
)


async def test_hash_is_argon2_format() -> None:
    """get_password_hash отдаёт именно Argon2-хэш (не bcrypt, не plaintext)."""
    hashed = await get_password_hash("CorrectHorseBatteryStaple")
    assert hashed.startswith("$argon2")


async def test_verify_correct_password_true() -> None:
    hashed = await get_password_hash("s3cret-pass")
    assert await verify_password("s3cret-pass", hashed) is True


async def test_verify_wrong_password_false() -> None:
    hashed = await get_password_hash("s3cret-pass")
    assert await verify_password("wrong-pass", hashed) is False


async def test_salt_makes_hashes_unique() -> None:
    """Один пароль → разные хэши (случайная соль)."""
    assert await get_password_hash("same") != await get_password_hash("same")


async def test_dummy_hash_is_valid_argon2() -> None:
    """Dummy-хэш для timing-attack защиты — валидный Argon2, verify не падает."""
    assert DUMMY_PASSWORD_HASH.startswith("$argon2")
    assert await verify_password("anything", DUMMY_PASSWORD_HASH) is False
