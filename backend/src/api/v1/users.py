import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rate_limit import limiter
from src.dependencies import get_current_user, get_db
from src.domain.models import Category, User
from src.infrastructure.redis_client import get_redis
from src.schemas.user import (
    CategoryCreate,
    CategoryRead,
    CategoryTransactionCount,
    CategoryUpdate,
    UserRead,
    UserUpdate,
)
from src.services.user_service import (
    count_category_transactions,
    create_user_category,
    delete_user_category,
    update_user_category,
    update_user_profile,
)

router = APIRouter(tags=["Users"])


@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await update_user_profile(
        db, db_user=current_user, update_data=user_in.model_dump(exclude_unset=True)
    )


@router.get("/categories", response_model=list[CategoryRead])
async def get_user_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Category).where(Category.user_id == current_user.id))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryRead, status_code=201)
async def post_user_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    return await create_user_category(db, user_id=current_user.id, category_in=category_in)


@router.get(
    "/categories/{category_id}/transaction-count",
    response_model=CategoryTransactionCount,
)
async def get_category_transaction_count(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    count = await count_category_transactions(db, category_id=category_id, user_id=current_user.id)
    if count == -1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена.",
        )
    return CategoryTransactionCount(category_id=category_id, transaction_count=count)


@router.patch("/categories/{category_id}", response_model=CategoryRead)
async def patch_user_category(
    category_id: int,
    category_in: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    updated = await update_user_category(
        db,
        category_id=category_id,
        user_id=current_user.id,
        payload=category_in,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена.",
        )
    return updated


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_category_route(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await delete_user_category(
        db,
        category_id=category_id,
        user_id=current_user.id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена.",
        )


@router.post("/telegram-link", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def generate_telegram_otp(
    request: Request,
    current_user: User = Depends(get_current_user),
    redis_client: Redis = Depends(get_redis),
) -> dict[str, Any]:
    otp_code = str(secrets.randbelow(900_000) + 100_000)
    redis_key = f"telegram_otp:{otp_code}"

    await redis_client.set(redis_key, str(current_user.id), ex=300)

    return {
        "code": otp_code,
        "expires_in": 300,
    }
