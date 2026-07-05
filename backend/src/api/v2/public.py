"""
Public API v2 — интеграция сторонних сервисов по API-ключу.

Аутентификация: заголовок `X-API-Key` (ключ формата cv_…, см. api_key_service).
Никаких cookie/JWT — стороннему сервису не нужен браузерный логин.

Идемпотентность записи: заголовок `Idempotency-Key` (UUID) прокидывается в
UNIQUE-колонку транзакции — повторный запрос не создаст дубль.
"""

from __future__ import annotations

import contextlib
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rate_limit import limiter
from src.dependencies import get_db
from src.domain.models import Category, Transaction, User
from src.schemas.api_key import PublicCategoryInfo, PublicTransactionCreate
from src.services.api_key_service import resolve_api_key

router = APIRouter(prefix="/v2/public", tags=["Public API v2"])


async def get_api_user(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Аутентификация по API-ключу: prefix-lookup + Argon2-верификация."""
    user = await resolve_api_key(db, x_api_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )
    return user


@router.get("/categories", response_model=list[PublicCategoryInfo])
@limiter.limit("60/minute")
async def list_categories(
    request: Request,
    db: AsyncSession = Depends(get_db),
    api_user: User = Depends(get_api_user),
) -> list[PublicCategoryInfo]:
    """Категории владельца ключа — чтобы внешний сервис знал валидные category_id."""
    categories = (
        (await db.execute(select(Category).where(Category.user_id == api_user.id))).scalars().all()
    )
    return [PublicCategoryInfo(id=c.id, name=c.name, type=c.type.value) for c in categories]


@router.post("/transactions", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def submit_transaction(
    request: Request,
    body: PublicTransactionCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    api_user: User = Depends(get_api_user),
) -> dict[str, int | str]:
    """Приём транзакции от стороннего сервиса в кошелёк владельца ключа."""
    category = (
        await db.execute(
            select(Category).where(
                Category.id == body.category_id, Category.user_id == api_user.id
            )
        )
    ).scalar_one_or_none()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found for this account",
        )

    tx = Transaction(
        user_id=api_user.id,
        category_id=category.id,
        amount=body.amount,
        currency=body.currency,
        is_recurring=False,
        entry_type="api",
        comment=body.comment,
        executed_at=body.executed_at or datetime.now(UTC),
        idempotency_key=idempotency_key,
    )
    db.add(tx)
    try:
        await db.commit()
    except IntegrityError:
        # Повторный Idempotency-Key — дубль не создаём, отвечаем идемпотентно.
        await db.rollback()
        existing_id: int | None = None
        if idempotency_key:
            with contextlib.suppress(Exception):
                existing_id = (
                    await db.execute(
                        select(Transaction.id).where(
                            Transaction.idempotency_key == idempotency_key
                        )
                    )
                ).scalar_one_or_none()
        return {"status": "duplicate", "transaction_id": existing_id or 0}

    await db.refresh(tx)
    return {"status": "created", "transaction_id": tx.id}
