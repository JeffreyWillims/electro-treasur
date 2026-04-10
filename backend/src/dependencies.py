"""
FastAPI Dependencies — Dependency Injection layer.

Provides async DB sessions and Redis clients to route handlers
via FastAPI's Depends() mechanism.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from src.database import async_session_factory
from src.domain.models import User
from src.infrastructure.redis_client import get_redis
from src.services.auth_service import decode_access_token
from src.services.user_service import get_user_by_email

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session, auto-close on exit."""
    async with async_session_factory() as session:
        yield session


async def get_redis_client() -> Redis:  # type: ignore[type-arg]
    """Return a shared async Redis client."""
    return await get_redis()


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Dependency to retrieve the current user based on the JWT token.
    Throws 401 if token is invalid or user is not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token_data = decode_access_token(token)
        if token_data.email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user
