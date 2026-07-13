"""
FastAPI Dependencies — слой Dependency Injection.

Предоставляет асинхронные сессии БД и клиенты Redis обработчикам роутов
через механизм Depends() из FastAPI.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import async_session_factory
from src.domain.models import User, UserRole
from src.infrastructure.redis_client import get_redis
from src.services.auth_service import decode_access_token
from src.services.user_service import get_user_by_email

ACCESS_COOKIE = "access_token"


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Отдать асинхронную сессию SQLAlchemy, автоматически закрыв её при выходе."""
    async with async_session_factory() as session:
        yield session


async def get_redis_client() -> Redis:
    """Вернуть общий асинхронный клиент Redis."""
    return await get_redis()


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """
    Получить текущего пользователя из httpOnly cookie access_token.
    Бросает 401, если cookie отсутствует/невалиден или пользователь не найден.
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


async def require_consultant(current_user: User = Depends(get_current_user)) -> User:
    """RBAC-гейт: пропускает только пользователей с ролью CONSULTANT (403 иначе).

    Роль проверяется по БД (source of truth), а не по JWT-клейму: смена роли
    действует сразу, не дожидаясь истечения access-токена.
    """
    if current_user.role != UserRole.consultant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Consultant role required",
        )
    return current_user
