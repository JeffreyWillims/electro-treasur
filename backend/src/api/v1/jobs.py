"""
SSE-стрим статуса фоновых arq-задач — живой прогресс вместо client-side polling.

GET /v1/jobs/{task_id}/stream (text/event-stream): сервер сам опрашивает arq и
шлёт события «pending» → «complete» (с результатом) / «error» / «timeout», затем
закрывает поток. Универсально: подходит и разбору выписок, и «AI Анализу».

Бюджет-сервер: заголовок `X-Accel-Buffering: no` отключает буферизацию nginx
для этого ответа — править nginx.conf не нужно.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Any

from arq.connections import ArqRedis, RedisSettings, create_pool
from arq.jobs import Job, JobResult
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from src.config import settings
from src.dependencies import get_current_user
from src.domain.models import User

router = APIRouter(tags=["Jobs"])

_POLL_INTERVAL = 0.4  # сек между опросами arq
_MAX_STREAM_SECONDS = 90  # предохранитель от вечного стрима

_arq_pool: ArqRedis | None = None
_pool_lock = asyncio.Lock()


async def _get_arq_pool() -> ArqRedis:
    global _arq_pool
    if _arq_pool is None:
        async with _pool_lock:
            if _arq_pool is None:
                _arq_pool = await create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    return _arq_pool


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/{task_id}/stream", summary="Server-sent live status of a background job")
async def stream_job(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    pool = await _get_arq_pool()

    async def events() -> AsyncIterator[str]:
        deadline = time.monotonic() + _MAX_STREAM_SECONDS
        while time.monotonic() < deadline:
            job = Job(task_id, pool)
            try:
                info = await job.info()
            except Exception:
                info = None

            # Ownership: первый аргумент задачи — user_id.
            if info is None or not info.args or info.args[0] != current_user.id:
                yield _sse({"status": "error", "detail": "not found"})
                return

            if isinstance(info, JobResult) and info.success and info.result is not None:
                yield _sse({"status": "complete", "result": info.result})
                return

            yield _sse({"status": "pending"})
            await asyncio.sleep(_POLL_INTERVAL)

        yield _sse({"status": "timeout"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx: не буферизовать этот ответ
            "Connection": "keep-alive",
        },
    )
