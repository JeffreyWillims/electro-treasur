from __future__ import annotations

import asyncio
import uuid
from collections.abc import Sequence

from arq.connections import ArqRedis, RedisSettings, create_pool
from arq.jobs import Job, JobResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import Insight, User
from src.schemas.insight import (
    InsightEnqueueResponse,
    InsightRequest,
    InsightResultResponse,
    LatestInsightResponse,
)

router = APIRouter(tags=["LLM Insights"])

# ── arq connection pool (lazy singleton) ────────────────────────────────
_arq_pool: ArqRedis | None = None
_pool_lock = asyncio.Lock()


async def _get_arq_pool() -> ArqRedis:
    """Lazy-init arq Redis pool for enqueuing jobs."""
    global _arq_pool
    if _arq_pool is None:
        async with _pool_lock:
            if _arq_pool is None:
                _arq_pool = await create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    return _arq_pool


@router.post(
    "/",
    response_model=InsightEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue LLM insight generation",
    description="Submits a background task via arq. Poll GET /insights/{task_id} for result.",
)
async def enqueue_insight(
    body: InsightRequest,
    current_user: User = Depends(get_current_user),
) -> InsightEnqueueResponse:
    pool = await _get_arq_pool()
    task_id = str(uuid.uuid4())

    await pool.enqueue_job(
        "generate_period_insight",
        current_user.id,
        body.start_date,
        body.end_date,
        _job_id=task_id,
    )

    return InsightEnqueueResponse(task_id=task_id, status="pending")


@router.get(
    "/latest",
    response_model=LatestInsightResponse | None,
    summary="Latest persisted monthly insight for current user",
    description="Reads the newest row from the insights table (nightly Cashflow Prophet).",
)
async def latest_insight(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Insight | None:
    stmt = (
        select(Insight)
        .where(Insight.user_id == current_user.id)
        .order_by(Insight.period_end.desc(), Insight.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


@router.get(
    "/",
    response_model=list[LatestInsightResponse],
    summary="Insight history for current user",
    description="All persisted monthly insights, newest first (capped by limit).",
)
async def list_insights(
    limit: int = Query(12, ge=1, le=60, description="Max rows, newest first"),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Sequence[Insight]:
    stmt = (
        select(Insight)
        .where(Insight.user_id == current_user.id)
        .order_by(Insight.period_end.desc(), Insight.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/{task_id}",
    response_model=InsightResultResponse,
    summary="Poll insight task status",
    description="Returns 'pending' while the LLM task is running, or the result JSON on completion.",
)
async def poll_insight(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> InsightResultResponse:
    pool = await _get_arq_pool()

    job = Job(task_id, pool)
    try:
        info = await job.info()
    except Exception:
        info = None

    # Задача не найдена (истекла/не существует) или принадлежит другому пользователю —
    # 404 без раскрытия деталей. Ownership: первый аргумент задачи — user_id (см. enqueue_insight).
    if info is None or not info.args or info.args[0] != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if isinstance(info, JobResult) and info.success and info.result is not None:
        return InsightResultResponse(
            task_id=task_id,
            status="complete",
            result=info.result,
        )

    return InsightResultResponse(task_id=task_id, status="pending")
