import contextlib
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.core.rate_limit import limiter
from src.dependencies import get_current_user, get_db, get_redis_client
from src.domain.models import User
from src.schemas.user import UserCreate, UserRead
from src.services.auth_service import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    DUMMY_PASSWORD_HASH,
    REFRESH_TOKEN_EXPIRE_SECONDS,
    InvalidRefreshToken,
    create_access_token,
    create_refresh_token,
    refresh_access_token,
    revoke_refresh_token,
    verify_password,
)
from src.services.user_service import create_user, get_user_by_email

router = APIRouter(tags=["Authentication"])

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Устанавливает httpOnly-cookie с токенами (защита от XSS-кражи токена)."""
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_SECONDS,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Удаляет оба auth-cookie (logout)."""
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/")


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def register_user(
    request: Request,
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> Any:
    user = await get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким адресом электронной почты уже существует.",
        )
    return await create_user(db, user_in=user_in.model_dump())


@router.post("/login")
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> dict[str, str]:
    # 1. Сначала достаем юзера
    user = await get_user_by_email(db, email=form_data.username)

    # 2. Вычисляем пароль независимо от того, найден ли юзер (защита от Timing Attack)
    if user:
        is_password_correct = await verify_password(form_data.password, user.hashed_password)
    else:
        # Запускаем вычисление вхолостую с валидным Argon2-хэшем, чтобы время ответа
        # не зависело от существования пользователя (защита от Timing Attack).
        await verify_password(form_data.password, DUMMY_PASSWORD_HASH)
        is_password_correct = False

    # 3. Принимаем решение
    if not user or not is_password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный адрес электронной почты или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = await create_refresh_token(redis, user.id)
    # Токены уходят ТОЛЬКО в httpOnly-cookie, не в теле ответа.
    _set_auth_cookies(response, access_token, refresh_token)
    return {"status": "authenticated"}


@router.post("/refresh")
@limiter.limit("10/minute")
async def refresh_tokens(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
) -> dict[str, str]:
    """Rotation: обменивает refresh-cookie на новую пару токенов (тоже в cookie)."""
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен отсутствует",
        )
    try:
        pair = await refresh_access_token(redis, db, refresh_token)
    except InvalidRefreshToken as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный refresh-токен",
        ) from e

    _set_auth_cookies(response, pair["access_token"], pair["refresh_token"])
    return {"status": "refreshed"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis_client),
) -> None:
    """Отзывает refresh-токен из Redis и удаляет auth-cookie."""
    refresh_token = request.cookies.get(REFRESH_COOKIE)
    if refresh_token:
        # Битый/чужой refresh — cookie всё равно чистим ниже.
        with contextlib.suppress(InvalidRefreshToken):
            await revoke_refresh_token(redis, current_user.id, refresh_token)
    _clear_auth_cookies(response)
