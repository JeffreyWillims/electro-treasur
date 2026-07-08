"""
Financial Health Score — GET /v1/health-score/ возвращает индекс 0..100.

Детерминированный, без LLM: считается из аналитики, целей и бюджетов пользователя.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import User
from src.schemas.health import HealthScoreResponse
from src.services.health_score_service import get_user_health_score

router = APIRouter(tags=["Health Score"])


@router.get("/", response_model=HealthScoreResponse, summary="Financial health score 0-100")
async def health_score(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> HealthScoreResponse:
    result = await get_user_health_score(session, current_user.id)
    return HealthScoreResponse.model_validate(result)
