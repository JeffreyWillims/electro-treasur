"""
FastAPI Dependencies — Dependency Injection layer.

Provides async DB sessions and Redis clients to route handlers
via FastAPI's Depends() mechanism.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import async_session_factory
from src.domain.models import User
from src.infrastructure.redis_client import get_redis
from src.services.auth_service import decode_access_token
from src.services.user_service import get_user_by_email

ACCESS_COOKIE = "access_token"


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async SQLAlchemy session, auto-close on exit."""
    async with async_session_factory() as session:
        yield session


async def get_redis_client() -> Redis:
    """Return a shared async Redis client."""
    return await get_redis()


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    """
    Retrieve the current user from the httpOnly access_token cookie.
    Throws 401 if the cookie is missing/invalid or the user is not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise credentials_exception
    try:
        token_data = decode_access_token(token)
        if token_data.email is None:
            raise credentials_exception
    except JWTError as e:
        raise credentials_exception from e

    user = await get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user
