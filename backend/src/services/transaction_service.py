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


from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.config import settings
from src.domain.models import Transaction
from src.schemas.transaction import TransactionCreate, TransactionResponse


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
    limit: int = 50,
    offset: int = 0,
) -> list[TransactionResponse]:
    """
    Fetch transactions for a given user with category names.
    Time Complexity: O(log N + M) where N is total transactions and M is the limit.
    """
    stmt = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.user_id == user_id)
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

    return responses
