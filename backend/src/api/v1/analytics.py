from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.analytics import (
    AnalyticsProfileResponse,
    SimulateRequest,
    SimulateResponse,
)
from src.schemas.insight import PsychopassportSchema
from src.services.analytics_service import get_analytics_profile, simulate_savings
from src.services.cashflow_prep import get_category_expense, get_period_totals
from src.services.psychopassport import build_psychopassport

router = APIRouter(tags=["Analytics"])

# Тот же предел, что и у дашборда: защита от запроса «за всё время».
MAX_PERIOD_DAYS = 366


@router.get("/profile", response_model=AnalyticsProfileResponse)
async def get_profile(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsProfileResponse:
    """Get average expenses for the last 3 months."""
    return await get_analytics_profile(session, current_user.id)


@router.get("/psychopassport", response_model=PsychopassportSchema)
async def get_psychopassport(
    start: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    end: date = Query(..., description="Конец периода включительно"),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PsychopassportSchema:
    """Психопаспорт трат за произвольный период.

    Раньше он существовал только внутри `Insight.summary`, который пишет
    месячный воркер: у новых пользователей психопаспорт был пуст, а карточка
    просто исчезала. Здесь он считается по требованию той же чистой функцией,
    поэтому доступен всем и за любой отрезок времени.
    """
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Начало периода позже конца",
        )
    if (end - start).days > MAX_PERIOD_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Период больше {MAX_PERIOD_DAYS} дней",
        )

    category_expense = await get_category_expense(session, current_user.id, start, end)
    income, expense = await get_period_totals(session, current_user.id, start, end)
    passport = build_psychopassport(category_expense, income, expense)
    return PsychopassportSchema(
        persona_code=passport.persona_code,
        persona_title=passport.persona_title,
        traits=passport.traits,
        recommendations=passport.recommendations,
    )


@router.post("/simulate", response_model=SimulateResponse)
async def simulate(
    request: SimulateRequest,
    current_user: User = Depends(get_current_user),
) -> SimulateResponse:
    """Simulate savings trajectory."""
    return await simulate_savings(request)
