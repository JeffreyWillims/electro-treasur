from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rate_limit import limiter
from src.dependencies import get_db
from src.schemas.token import Token
from src.schemas.user import UserCreate, UserRead
from src.services.auth_service import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    verify_password,
)
from src.services.user_service import create_user, get_user_by_email

router = APIRouter(tags=["Authentication"])


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


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login_for_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    # 1. Сначала достаем юзера
    user = await get_user_by_email(db, email=form_data.username)

    # 2. Вычисляем пароль независимо от того, найден ли юзер (защита от Timing Attack)
    if user:
        is_password_correct = await verify_password(form_data.password, user.hashed_password)
    else:
        # Запускаем вычисление вхолостую с фейковым, но СТРУКТУРНО ВАЛИДНЫМ хэшем.
        # Это реальный хэш от случайной строки, чтобы passlib/bcrypt не выдали ошибку 500.
        dummy_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKYcaxkG1GzXyCq"
        await verify_password(form_data.password, dummy_hash)
        is_password_correct = False

    # 3. Принимаем решение
    if not user or not is_password_correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный адрес электронной почты или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
