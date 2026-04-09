"""
Dashboard Router — GET /api/v1/dashboard/

JWT-authenticated. Returns the monthly budget matrix:
  Category → Plan → Fact → Delta → 31 day cells.
"""

from __future__ import annotations
from datetime import date

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
    summary="Date-range budget dashboard matrix",
    description=(
        "Aggregated view: each category row contains planned amount, "
        "actual total, delta, and a dynamic vector with daily spend."
    ),
)
async def get_dashboard(
    start_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """
    Time:  O(N + K) where N=transactions, K=categories.
    Space: O(K * N_days) for the day matrix.
    """
    return await get_monthly_dashboard(session, current_user.id, start_date, end_date)
