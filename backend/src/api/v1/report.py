"""
Серверная генерация PDF-отчёта «Личный финансовый план».

GET /v1/reports/financial-plan.pdf — собирает последний инсайт + цели текущего
пользователя и отдаёт готовый PDF (attachment).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import Insight, SavingsGoal, User
from src.services.pdf_report_service import build_financial_plan_pdf

router = APIRouter(tags=["Reports"])


@router.get("/financial-plan.pdf", summary="Download personal financial plan PDF")
async def financial_plan_pdf(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    insight = (
        await session.execute(
            select(Insight)
            .where(Insight.user_id == current_user.id)
            .order_by(Insight.period_end.desc(), Insight.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    goals = (
        (
            await session.execute(
                select(SavingsGoal)
                .where(SavingsGoal.user_id == current_user.id)
                .order_by(SavingsGoal.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    pdf_bytes = build_financial_plan_pdf(
        full_name=current_user.full_name,
        email=current_user.email,
        insight=insight,
        goals=goals,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="financial-plan.pdf"'},
    )
