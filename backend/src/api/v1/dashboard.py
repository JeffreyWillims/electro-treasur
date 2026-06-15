from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.dashboard import DashboardResponse
from src.services.dashboard_service import get_monthly_dashboard

router = APIRouter(tags=["Dashboard"])


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
    # 1. Защита от логической ошибки инверсии дат (Fail Fast)
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date не может быть позже end_date",
        )

    # 2. Защита от Application-level DoS (ограничение агрегации 90 днями)
    if (end_date - start_date).days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Диапазон дат не должен превышать 90 дней",
        )

    return await get_monthly_dashboard(session, current_user.id, start_date, end_date)
