"""
Bank deposit offers — CPA monetization for Savings Navigator.

GET  /v1/offers/            — active offers, rate-sorted (admin-managed).
POST /v1/offers/{id}/click  — funnel counter before redirecting to partner.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import BankOffer, User
from src.schemas.offer import BankOfferRead

router = APIRouter(tags=["Bank Offers"])


@router.get("/", response_model=list[BankOfferRead], summary="List active deposit offers")
async def list_offers(
    db: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[BankOffer]:
    stmt = (
        select(BankOffer)
        .where(BankOffer.is_active.is_(True))
        .order_by(BankOffer.sort_order, BankOffer.rate.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/{offer_id}/click",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Register a partner-link click",
)
async def register_click(
    offer_id: int,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> None:
    stmt = (
        update(BankOffer)
        .where(BankOffer.id == offer_id, BankOffer.is_active.is_(True))
        .values(clicks=BankOffer.clicks + 1)
        .returning(BankOffer.id)
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    await db.commit()
