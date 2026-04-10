"""
Transactions Router — POST /api/v1/transactions/

JWT-authenticated. User identity extracted from Bearer token via get_current_user.
Idempotency-Key header protection against race conditions / double-spend.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from src.dependencies import get_current_user, get_db, get_redis_client
from src.domain.models import User
from src.schemas.transaction import (TransactionCreate, TransactionResponse,
                                     TransactionUpdate)
from src.services.transaction_service import (create_transaction,
                                              delete_transaction,
                                              list_transactions,
                                              update_transaction)

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.post(
    "/",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a transaction (idempotent)",
    description=(
        "Idempotency-Key header is optional but recommended. "
        "Duplicate keys within 24h return the cached response without DB write."
    ),
)
async def post_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),  # type: ignore[type-arg]
    current_user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> TransactionResponse:
    """
    Insert a transaction with optional idempotency protection.
    User identity derived from JWT — no header spoofing possible.
    """
    return await create_transaction(
        session=session,
        redis=redis,
        user_id=current_user.id,
        payload=payload,
        idempotency_key=idempotency_key,
    )


@router.get("/", response_model=list[TransactionResponse])
async def get_transactions(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
) -> list[TransactionResponse]:
    """
    Retrieve transactions for the authenticated user.
    """
    return await list_transactions(
        session=session,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def patch_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
    """
    Partially update an existing transaction.
    """
    resp = await update_transaction(
        session=session,
        transaction_id=transaction_id,
        user_id=current_user.id,
        payload=payload,
    )
    if getattr(resp, "id", None) is None and resp is None:  # explicit check
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or not authorized",
        )
    return resp


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_endpoint(
    transaction_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a transaction.
    """
    success = await delete_transaction(
        session=session, transaction_id=transaction_id, user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or not authorized",
        )
