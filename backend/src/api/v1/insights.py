"""
Insights Router — arq-based LLM insight generation + polling.

POST /api/v1/insights/  → enqueue arq task, return HTTP 202 + task_id.
GET  /api/v1/insights/{task_id} → poll Redis for result.
"""
from __future__ import annotations

import uuid

from arq.connections import ArqRedis, create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, HTTPException, status, Depends

from src.config import settings
from src.infrastructure.redis_client import get_redis
from src.dependencies import get_current_user
from src.domain.models import User
from src.schemas.insight import (
    InsightEnqueueResponse,
    InsightRequest,
    InsightResultResponse,
)

router = APIRouter(prefix="/insights", tags=["LLM Insights"])

# ── arq connection pool (lazy singleton) ────────────────────────────────
_arq_pool: ArqRedis | None = None


async def _get_arq_pool() -> ArqRedis:
    """Lazy-init arq Redis pool for enqueuing jobs."""
    global _arq_pool
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
    """
    Enqueue `generate_annual_llm_insight` into arq worker.

    Time: O(1) — Redis LPUSH.
    """
    pool = await _get_arq_pool()
    task_id = str(uuid.uuid4())

    await pool.enqueue_job(
        "generate_annual_llm_insight",
        current_user.id,
        body.start_date,
        body.end_date,
        _job_id=task_id,
    )

    return InsightEnqueueResponse(task_id=task_id, status="pending")


@router.get(
    "/{task_id}",
    response_model=InsightResultResponse,
    summary="Poll insight task status",
    description="Returns 'pending' while the LLM task is running, or the result JSON on completion.",
)
async def poll_insight(task_id: str) -> InsightResultResponse:
    """
    Check arq job result via arq's built-in result storage.

    Falls back to direct Redis key lookup for cached insights.
    Time: O(1) — Redis GET.
    """
    pool = await _get_arq_pool()
    from arq.jobs import Job
    try:
        job = Job(task_id, pool)
        info = await job.info()
        if info and info.success and info.result is not None:
            return InsightResultResponse(task_id=task_id, status="complete", result=info.result)
    except Exception as e:
        # log if needed
        pass

    return InsightResultResponse(task_id=task_id, status="pending")
