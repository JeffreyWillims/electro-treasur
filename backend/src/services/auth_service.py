import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt
from pydantic import BaseModel

from src.config import settings

# ── Security Configuration ───────────────────────────────────────────────────
# secret_key and algorithm are read from settings (ET_SECRET_KEY env var).
# The app will fail fast on startup if ET_SECRET_KEY is not set.
# ACCESS_TOKEN_EXPIRE_MINUTES is non-sensitive operational config.
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours for MVP stability

ph = PasswordHasher()


class TokenData(BaseModel):
    email: str | None = None


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """
    Encodes data into a JWT access token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = cast(
        str, jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    )
    return encoded_jwt


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against its hashed version using Argon2 inside a thread pool.
    """

    def _verify() -> bool:
        try:
            return bool(ph.verify(hashed_password, plain_password))
        except VerifyMismatchError:
            return False

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _verify)


async def get_password_hash(password: str) -> str:
    """
    Generates an Argon2 hash of the password inside a thread pool.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, ph.hash, password)


def decode_access_token(token: str) -> TokenData:
    """
    Decodes and validates a JWT token.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise JWTError("Invalid token: missing subject")
        return TokenData(email=email)
    except JWTError as e:
        raise e
