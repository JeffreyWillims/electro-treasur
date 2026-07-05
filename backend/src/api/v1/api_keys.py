"""
API Keys management — авторизованный пользователь выпускает/отзывает ключи
для публичного /api/v2/public. Секрет виден один раз в момент создания.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import ApiKey, User
from src.schemas.api_key import ApiKeyCreatedResponse, ApiKeyCreateRequest, ApiKeyInfo
from src.services.api_key_service import create_api_key

router = APIRouter(tags=["API Keys"])

MAX_KEYS_PER_USER = 10


@router.post("/", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def issue_api_key(
    body: ApiKeyCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApiKeyCreatedResponse:
    """Выпустить новый ключ. Полный секрет возвращается ТОЛЬКО в этом ответе."""
    count = len(
        (
            await db.execute(
                select(ApiKey.id).where(
                    ApiKey.user_id == current_user.id, ApiKey.is_active.is_(True)
                )
            )
        ).all()
    )
    if count >= MAX_KEYS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Лимит активных ключей: {MAX_KEYS_PER_USER}",
        )

    api_key, plain_key = await create_api_key(db, current_user.id, body.name)
    return ApiKeyCreatedResponse(
        id=api_key.id, name=api_key.name, prefix=api_key.prefix, api_key=plain_key
    )


@router.get("/", response_model=list[ApiKeyInfo])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ApiKeyInfo]:
    """Список ключей пользователя (без секретов)."""
    keys = (
        (
            await db.execute(
                select(ApiKey)
                .where(ApiKey.user_id == current_user.id)
                .order_by(ApiKey.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [ApiKeyInfo.model_validate(k) for k in keys]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_key(
    key_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Отозвать ключ (мягко: is_active=False, история сохраняется)."""
    api_key = (
        await db.execute(
            select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if api_key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ключ не найден")
    api_key.is_active = False
    await db.commit()
