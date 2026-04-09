"""
Yearly Analytics Router — arq-based (NO Celery).

POST /api/analytics/yearly          → enqueue yearly LLM report task.
GET  /api/analytics/tasks/{task_id} → poll for result.

Uses the same arq infrastructure as insights, but targets
the yearly analytics flow with ProcessPoolExecutor offloading.
"""

from __future__ import annotations

import json
import uuid

from arq.connections import ArqRedis, RedisSettings, create_pool
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from src.config import settings
from src.dependencies import get_current_user
from src.domain.models import User

router = APIRouter(prefix="/analytics", tags=["Yearly Analytics"])

_arq_pool: ArqRedis | None = None


async def _get_arq_pool() -> ArqRedis:
    global _arq_pool
    if _arq_pool is None:
        _arq_pool = await create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    return _arq_pool


# ── Schemas ─────────────────────────────────────────────────────────────
class YearlyAnalyticsRequest(BaseModel):
    year: int = Field(..., ge=2000, le=2100)


class YearlyEnqueueResponse(BaseModel):
    task_id: str
    status: str = "pending"


class YearlyTaskStatusResponse(BaseModel):
    task_id: str
    status: str  # "pending" | "complete"
    result: dict | None = None


# ── Endpoints ───────────────────────────────────────────────────────────
@router.post(
    "/yearly",
    response_model=YearlyEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue yearly LLM analytics report",
)
async def enqueue_yearly_analytics(
    body: YearlyAnalyticsRequest,
    current_user: User = Depends(get_current_user),
) -> YearlyEnqueueResponse:
    """
    Enqueue `generate_annual_llm_insight` for full-year analysis.
    Reuses the same arq task — CPU-bound work is offloaded via ProcessPoolExecutor.

    Time: O(1) — Redis enqueue.
    """
    pool = await _get_arq_pool()
    task_id = str(uuid.uuid4())

    await pool.enqueue_job(
        "generate_annual_llm_insight",
        current_user.id,
        body.year,
        _job_id=task_id,
    )

    return YearlyEnqueueResponse(task_id=task_id, status="pending")


@router.get(
    "/tasks/{task_id}",
    response_model=YearlyTaskStatusResponse,
    summary="Poll yearly analytics task status",
)
async def poll_yearly_task(task_id: str) -> YearlyTaskStatusResponse:
    """
    Poll arq result for the yearly analytics task.

    Time: O(1) — Redis GET.
    """
    pool = await _get_arq_pool()
    raw = await pool.get(f"arq:result:{task_id}")

    if raw is not None:
        try:
            result = json.loads(raw)
            if isinstance(result, dict) and "result" in result:
                return YearlyTaskStatusResponse(
                    task_id=task_id, status="complete", result=result["result"]
                )
            return YearlyTaskStatusResponse(
                task_id=task_id, status="complete", result=result
            )
        except (json.JSONDecodeError, TypeError):
            pass

    return YearlyTaskStatusResponse(task_id=task_id, status="pending")
