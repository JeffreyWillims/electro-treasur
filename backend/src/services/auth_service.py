import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt
from pydantic import BaseModel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.domain.models import User
from src.infrastructure.redis_client import (
    delete_refresh_token,
    is_refresh_token_valid,
    store_refresh_token,
)

# ── Security Configuration ───────────────────────────────────────────────────
# secret_key and algorithm are read from settings (ET_SECRET_KEY env var).
# The app will fail fast on startup if ET_SECRET_KEY is not set.
# Короткий access-токен (15 мин) + отзываемый refresh в Redis — см. create_refresh_token.
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_SECONDS = settings.refresh_token_expire_days * 24 * 60 * 60

ph = PasswordHasher()


class InvalidRefreshToken(Exception):
    """Refresh-токен отсутствует, истёк, отозван или имеет неверный формат."""

# Валидный Argon2-хэш случайной строки. Используется для «холостой» проверки пароля,
# когда пользователь не найден, чтобы время ответа не выдавало его существование
# (защита от Timing Attack). Вычисляется один раз и всегда соответствует параметрам ph.
DUMMY_PASSWORD_HASH = ph.hash("timing-attack-mitigation-dummy-password")


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


# ── Refresh Token Rotation ───────────────────────────────────────────────────
# Refresh-токен клиенту — непрозрачная строка "{user_id}:{token_id}"; сам секрет
# (token_id, UUID4) хранится только в Redis. JWT здесь не используется намеренно,
# чтобы токен можно было отозвать мгновенно (logout / rotation).


async def create_refresh_token(redis: Redis, user_id: int) -> str:
    """Генерирует refresh-токен, сохраняет его в Redis и возвращает клиенту."""
    token_id = str(uuid.uuid4())
    await store_refresh_token(redis, user_id, token_id, ttl=REFRESH_TOKEN_EXPIRE_SECONDS)
    return f"{user_id}:{token_id}"


def _parse_refresh_token(refresh_token: str) -> tuple[int, str]:
    """Разбирает "{user_id}:{token_id}"; неверный формат → InvalidRefreshToken."""
    user_id_str, sep, token_id = refresh_token.partition(":")
    if not sep or not token_id or not user_id_str.isdigit():
        raise InvalidRefreshToken("Malformed refresh token")
    return int(user_id_str), token_id


async def refresh_access_token(
    redis: Redis, db: AsyncSession, refresh_token: str
) -> dict[str, str]:
    """
    Rotation: валидирует старый refresh, отзывает его и выдаёт НОВУЮ пару токенов.

    Старый refresh становится невалидным немедленно — повторное использование
    (в т.ч. украденного) вернёт ошибку.
    """
    user_id, token_id = _parse_refresh_token(refresh_token)

    if not await is_refresh_token_valid(redis, user_id, token_id):
        raise InvalidRefreshToken("Refresh token is invalid, expired or already used")

    # Rotation: старый одноразовый — отзываем до выпуска нового.
    await delete_refresh_token(redis, user_id, token_id)

    user = await db.get(User, user_id)
    if user is None:
        raise InvalidRefreshToken("User no longer exists")

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    new_refresh_token = await create_refresh_token(redis, user_id)
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


async def revoke_refresh_token(redis: Redis, user_id: int, refresh_token: str) -> None:
    """Logout: отзывает refresh-токен, если он принадлежит user_id."""
    parsed_user_id, token_id = _parse_refresh_token(refresh_token)
    if parsed_user_id != user_id:
        raise InvalidRefreshToken("Refresh token does not belong to the current user")
    await delete_refresh_token(redis, user_id, token_id)
