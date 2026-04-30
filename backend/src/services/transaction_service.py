"""
Transaction Service — Idempotent writes protected by Redis + DB UNIQUE.

Race-condition defence (double-spend prevention):
  1. Check Redis for `idempotency:{key}` — O(1) GET.
     On HIT → return cached response immediately (no DB round-trip).
  2. On MISS → INSERT with idempotency_key → DB UNIQUE constraint is the
     last-resort guard if two requests slip through Redis concurrently.
  3. On successful INSERT → SET Redis key with TTL 24 h.

Time:  O(1) amortized per request.
Space: O(1) Redis memory per unique key (auto-evicted by TTL).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from redis.asyncio import Redis
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.config import settings
from src.domain.models import Category, Transaction
from src.schemas.transaction import (
    TransactionCreate,
    TransactionPaginatedResponse,
    TransactionResponse,
    TransactionUpdate,
)


async def create_transaction(
    session: AsyncSession,
    redis: Redis,  # type: ignore[type-arg]
    user_id: int,
    payload: TransactionCreate,
    idempotency_key: str | None,
) -> TransactionResponse:
    """
    Insert a new transaction with idempotency protection.

    Args:
        session: Async DB session.
        redis: Async Redis client.
        user_id: Authenticated user ID.
        payload: Validated transaction data.
        idempotency_key: UUID from Idempotency-Key header (optional).

    Returns:
        TransactionResponse — either fresh INSERT or cached duplicate.

    Raises:
        sqlalchemy.exc.IntegrityError if DB-level UNIQUE violated
        (should be caught by caller / middleware).
    """
    # ── Step 1: Redis dedup check — O(1) ────────────────────────────────
    if idempotency_key:
        cache_key = f"idempotency:{idempotency_key}"
        cached = await redis.get(cache_key)
        if cached:
            return TransactionResponse.model_validate_json(cached)

    # ── Step 2: DB INSERT — O(1) amortized (B-Tree on PK) ──────────────
    tx = Transaction(
        user_id=user_id,
        category_id=payload.category_id,
        amount=payload.amount,
        currency=payload.currency,
        is_recurring=payload.is_recurring,
        entry_type=payload.entry_type,
        executed_at=payload.executed_at,
        idempotency_key=idempotency_key,
    )
    session.add(tx)
    await session.commit()
    await session.refresh(tx)

    response = TransactionResponse.model_validate(tx)

    # ── Step 3: Cache in Redis — O(1) SET with TTL ──────────────────────
    if idempotency_key:
        await redis.set(
            cache_key,  # type: ignore[possibly-undefined]
            response.model_dump_json(),
            ex=settings.redis_idempotency_ttl,
        )

    return response


async def list_transactions(
    session: AsyncSession,
    user_id: int,
    limit: int = 10,
    offset: int = 0,
    category_id: int | None = None,
    tx_type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
) -> TransactionPaginatedResponse:
    """
    Fetch transactions for a given user with dynamic filtering.
    Time Complexity: O(log N + M) where N is total transactions and M is the limit.
    """
    conditions = [Transaction.user_id == user_id]

    if category_id is not None:
        conditions.append(Transaction.category_id == category_id)
    if tx_type is not None:
        conditions.append(Category.type == tx_type)
    if min_amount is not None:
        conditions.append(Transaction.amount >= min_amount)
    if max_amount is not None:
        conditions.append(Transaction.amount <= max_amount)
    if start_date is not None:
        from datetime import datetime, time

        start_datetime = datetime.combine(start_date, time.min)
        conditions.append(Transaction.executed_at >= start_datetime)
    if end_date is not None:
        from datetime import datetime, time

        end_datetime = datetime.combine(end_date, time.max)
        conditions.append(Transaction.executed_at <= end_datetime)
    if search is not None and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(
            or_(
                Transaction.comment.ilike(pattern),
                Category.name.ilike(pattern),
            )
        )

    count_stmt = (
        select(func.count(Transaction.id)).join(Transaction.category).where(*conditions)
    )
    total_result = await session.execute(count_stmt)
    total = total_result.scalar() or 0

    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .join(Transaction.category)
        .where(*conditions)
        .order_by(Transaction.executed_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    transactions = result.scalars().all()

    responses = []
    for tx in transactions:
        resp = TransactionResponse.model_validate(tx)
        resp.category_name = tx.category.name if tx.category else "Unknown"
        responses.append(resp)

    return TransactionPaginatedResponse(items=responses, total=total)


async def get_transaction_by_id_and_user(
    session: AsyncSession, transaction_id: int, user_id: int
) -> Transaction | None:
    """
    Fetch a transaction by ID, ensuring it belongs to the specified user.
    """
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.id == transaction_id, Transaction.user_id == user_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def update_transaction(
    session: AsyncSession,
    transaction_id: int,
    user_id: int,
    payload: TransactionUpdate,
) -> TransactionResponse | None:
    """
    Partially update a transaction. Returns None if not found or not owned by user.
    """
    tx = await get_transaction_by_id_and_user(session, transaction_id, user_id)
    if not tx:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tx, key, value)

    await session.commit()
    await session.refresh(tx)

    # Re-fetch if category was changed to eagerly load the new Category relationship
    if "category_id" in update_data:
        stmt = (
            select(Transaction)
            .options(joinedload(Transaction.category))
            .where(Transaction.id == transaction_id)
        )
        result = await session.execute(stmt)
        tx = result.scalar_one()

    resp = TransactionResponse.model_validate(tx)
    resp.category_name = tx.category.name if tx.category else "Unknown"
    return resp


async def delete_transaction(
    session: AsyncSession,
    transaction_id: int,
    user_id: int,
) -> bool:
    """
    Deletes a transaction. Returns False if not found or not owned by user.
    """
    tx = await get_transaction_by_id_and_user(session, transaction_id, user_id)
    if not tx:
        return False

    await session.delete(tx)
    await session.commit()
    return True
