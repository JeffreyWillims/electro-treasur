"""
Dashboard Router — GET /api/v1/dashboard/

JWT-authenticated. Returns the monthly budget matrix:
  Category → Plan → Fact → Delta → 31 day cells.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_db, get_current_user
from src.domain.models import User
from src.schemas.dashboard import DashboardResponse
from src.services.dashboard_service import get_monthly_dashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/",
    response_model=DashboardResponse,
    summary="Monthly budget dashboard matrix",
    description=(
        "Aggregated view: each category row contains planned amount, "
        "actual total, delta, and a 31-element array with daily spend."
    ),
)
async def get_dashboard(
    month: int = Query(..., ge=1, le=12, description="Month (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Year"),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """
    Time:  O(N + K) where N=transactions, K=categories.
    Space: O(K * 31) for the day matrix.
    """
    return await get_monthly_dashboard(session, current_user.id, year, month)
