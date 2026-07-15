from __future__ import annotations

import asyncio
import uuid
from typing import Any

from arq.connections import ArqRedis, RedisSettings, create_pool
from arq.jobs import Job, JobResult
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from src.config import settings
from src.dependencies import get_current_user
from src.domain.models import User

router = APIRouter(prefix="/analytics", tags=["Yearly Analytics"])

_arq_pool: ArqRedis | None = None
_pool_lock = asyncio.Lock()


async def _get_arq_pool() -> ArqRedis:
    global _arq_pool
    if _arq_pool is None:
        async with _pool_lock:
            if _arq_pool is None:
                _arq_pool = await create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    return _arq_pool


# ── Схемы ─────────────────────────────────────────────────────────────
class YearlyAnalyticsRequest(BaseModel):
    year: int = Field(..., ge=2000, le=2100)


class YearlyEnqueueResponse(BaseModel):
    task_id: str
    status: str = "pending"


class YearlyTaskStatusResponse(BaseModel):
    task_id: str
    status: str  # "pending" | "complete"
    result: dict[str, Any] | None = None


# ── Эндпоинты ───────────────────────────────────────────────────────────
@router.post(
    "/yearly",
    response_model=YearlyEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue yearly analytics report",
)
async def enqueue_yearly_analytics(
    body: YearlyAnalyticsRequest,
    current_user: User = Depends(get_current_user),
) -> YearlyEnqueueResponse:

    pool = await _get_arq_pool()
    task_id = str(uuid.uuid4())

    # Год → полный диапазон дат: задача ждёт (user_id, start_date_str, end_date_str).
    await pool.enqueue_job(
        "generate_period_insight",
        current_user.id,
        f"{body.year}-01-01",
        f"{body.year}-12-31",
        _job_id=task_id,
    )

    return YearlyEnqueueResponse(task_id=task_id, status="pending")


@router.get(
    "/tasks/{task_id}",
    response_model=YearlyTaskStatusResponse,
    summary="Poll yearly analytics task status",
)
async def poll_yearly_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> YearlyTaskStatusResponse:

    pool = await _get_arq_pool()
    job = Job(task_id, pool)

    try:
        info = await job.info()
    except Exception:
        info = None

    # Задача не найдена (истекла/не существует) или принадлежит другому пользователю —
    # 404 без раскрытия деталей. Ownership: первый аргумент задачи — user_id (см. enqueue).
    if info is None or not info.args or info.args[0] != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if isinstance(info, JobResult) and info.success and info.result is not None:
        return YearlyTaskStatusResponse(task_id=task_id, status="complete", result=info.result)

    return YearlyTaskStatusResponse(task_id=task_id, status="pending")
