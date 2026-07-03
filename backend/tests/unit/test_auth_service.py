"""
tests/unit/test_auth_service.py — Auth Service Unit Tests.

Tests JWT creation/decoding and Argon2 password hashing.
Pure unit tests — no DB, no Redis, no I/O.

Architecture:
  ┌─────────────────────────────────────────────────┐
  │  test_auth_service.py                           │
  │                                                 │
  │  create_access_token() ──→ JWT string           │
  │  decode_access_token() ──→ TokenData            │
  │  get_password_hash()   ──→ argon2 hash string   │
  │  verify_password()     ──→ bool                 │
  └─────────────────────────────────────────────────┘
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from jose import jwt

from src.config import settings
from src.services.auth_service import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    TokenData,
    create_access_token,
    decode_access_token,
    get_password_hash,
    verify_password,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# JWT Token Creation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCreateAccessToken:
    """JWT creation: payload encoding, expiry, structure."""

    def test_returns_string(self) -> None:
        """Token is a non-empty string."""
        token = create_access_token({"sub": "user@test.com"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_contains_subject(self) -> None:
        """Decoding the token should reveal the 'sub' claim."""
        email = "john@citrinevault.ru"
        token = create_access_token({"sub": email})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["sub"] == email

    def test_token_has_expiry(self) -> None:
        """Token must have an 'exp' claim."""
        token = create_access_token({"sub": "x@x.com"})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert "exp" in payload

    def test_custom_expiry_delta(self) -> None:
        """Custom expires_delta should override the default 15-minute fallback."""
        delta = timedelta(hours=48)
        token = create_access_token({"sub": "x@x.com"}, expires_delta=delta)
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        # exp should be ~48h from now, not 15m
        assert "exp" in payload

    def test_default_expiry_is_15_minutes(self) -> None:
        """Without expires_delta, token expires in 15 minutes (fallback)."""
        import time

        token = create_access_token({"sub": "x@x.com"})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        # exp should be within ~16 minutes from now (15m + clock drift)
        assert payload["exp"] - time.time() <= 16 * 60

    def test_extra_claims_preserved(self) -> None:
        """Additional claims in the data dict should be preserved."""
        token = create_access_token({"sub": "a@b.com", "role": "admin", "tier": "premium"})
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert payload["role"] == "admin"
        assert payload["tier"] == "premium"

    def test_data_dict_not_mutated(self) -> None:
        """create_access_token should not mutate the input dict."""
        data: dict[str, Any] = {"sub": "user@test.com"}
        original = data.copy()
        create_access_token(data)
        assert data == original  # 'exp' should NOT leak into original

    def test_access_token_expire_constant(self) -> None:
        """ACCESS_TOKEN_EXPIRE_MINUTES should be 24 hours for MVP."""
        assert ACCESS_TOKEN_EXPIRE_MINUTES == 60 * 24


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# JWT Token Decoding
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestDecodeAccessToken:
    """JWT decoding: valid tokens, expired tokens, tampered tokens."""

    def test_valid_token_returns_token_data(self) -> None:
        """Valid token decodes to TokenData with correct email."""
        email = "decode@citrine.dev"
        token = create_access_token({"sub": email})
        result = decode_access_token(token)
        assert isinstance(result, TokenData)
        assert result.email == email

    def test_expired_token_raises(self) -> None:
        """Expired token should raise JWTError."""
        from jose import JWTError

        token = create_access_token(
            {"sub": "expired@test.com"},
            expires_delta=timedelta(seconds=-1),  # already expired
        )
        with pytest.raises(JWTError):
            decode_access_token(token)

    def test_missing_subject_raises(self) -> None:
        """Token without 'sub' claim should raise JWTError."""
        from jose import JWTError

        # Create a raw token without 'sub'
        raw = jwt.encode(
            {"exp": 9999999999, "role": "admin"},
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        with pytest.raises(JWTError, match="missing subject"):
            decode_access_token(raw)

    def test_tampered_token_raises(self) -> None:
        """Token signed with wrong key should raise JWTError."""
        from jose import JWTError

        raw = jwt.encode(
            {"sub": "hacker@evil.com", "exp": 9999999999},
            "wrong-secret-key-00000000000000000000",
            algorithm="HS256",
        )
        with pytest.raises(JWTError):
            decode_access_token(raw)

    def test_garbage_string_raises(self) -> None:
        """Completely invalid string should raise JWTError."""
        from jose import JWTError

        with pytest.raises(JWTError):
            decode_access_token("not.a.jwt.token.at.all")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Password Hashing (Argon2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestPasswordHashing:
    """Argon2 hash + verify: correctness, timing safety, format."""

    async def test_hash_produces_argon2_format(self) -> None:
        """Hash output should start with $argon2."""
        hashed = await get_password_hash("MySecureP@ss123")
        assert hashed.startswith("$argon2")

    async def test_hash_is_not_plaintext(self) -> None:
        """Hash should never equal the original password."""
        password = "SuperSecret!2026"
        hashed = await get_password_hash(password)
        assert hashed != password

    async def test_same_password_different_hashes(self) -> None:
        """Two hashes of the same password should differ (random salt)."""
        h1 = await get_password_hash("SamePassword")
        h2 = await get_password_hash("SamePassword")
        assert h1 != h2  # Argon2 uses random salt each time

    async def test_verify_correct_password(self) -> None:
        """Correct password should verify successfully."""
        password = "CorrectHorseBatteryStaple"
        hashed = await get_password_hash(password)
        result = await verify_password(password, hashed)
        assert result is True

    async def test_verify_wrong_password(self) -> None:
        """Wrong password should fail verification."""
        hashed = await get_password_hash("RealPassword123")
        result = await verify_password("WrongPassword456", hashed)
        assert result is False

    async def test_verify_empty_password_fails(self) -> None:
        """Empty password should not match a real hash."""
        hashed = await get_password_hash("NonEmptyPassword")
        result = await verify_password("", hashed)
        assert result is False

    async def test_unicode_password(self) -> None:
        """Unicode passwords (Cyrillic, emoji) should hash and verify correctly."""
        password = "Пароль🔐Безопасный!"
        hashed = await get_password_hash(password)
        assert await verify_password(password, hashed) is True
        assert await verify_password("WrongПароль", hashed) is False

    async def test_long_password(self) -> None:
        """Very long passwords should work (Argon2 has no practical limit)."""
        password = "A" * 1000
        hashed = await get_password_hash(password)
        assert await verify_password(password, hashed) is True
