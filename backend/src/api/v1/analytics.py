"""
Analytics API Router for Savings Navigator.

JWT-authenticated. User identity from Bearer token.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.analytics import (AnalyticsProfileResponse, SimulateRequest,
                                   SimulateResponse)
from src.services.analytics_service import (get_analytics_profile,
                                            simulate_savings)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/profile", response_model=AnalyticsProfileResponse)
async def get_profile(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsProfileResponse:
    """Get average expenses for the last 3 months."""
    return await get_analytics_profile(session, current_user.id)


@router.post("/simulate", response_model=SimulateResponse)
async def simulate(
    request: SimulateRequest,
    current_user: User = Depends(get_current_user),
) -> SimulateResponse:
    """Simulate savings trajectory."""
    return await simulate_savings(request)
