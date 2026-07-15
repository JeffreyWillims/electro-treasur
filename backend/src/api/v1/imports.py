"""
Импорт транзакций из выписок (PDF / изображение / Excel) — без LLM.

POST /v1/imports/statement        — загрузить файл → arq-разбор → task_id.
GET  /v1/imports/{task_id}         — опрос статуса → кандидаты (превью).
POST /v1/imports/confirm           — подтверждённые строки → импорт (dedup).

Разбор офлоадится в воркер (тяжёлый pdfplumber/OCR); импорт переиспользует
существующий import_transactions (категории + идемпотентность + ON CONFLICT).
"""

from __future__ import annotations

import asyncio
import base64
import csv
import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from arq.connections import ArqRedis, RedisSettings, create_pool
from arq.jobs import Job, JobResult
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import User
from src.services.import_export_service import import_transactions

router = APIRouter(tags=["Statement Import"])

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB — выписки маленькие; защита от заливки
_ALLOWED_EXT = {"pdf", "png", "jpg", "jpeg", "webp", "xlsx", "xls"}

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
class StatementEnqueueResponse(BaseModel):
    task_id: str
    status: str = "pending"


class StatementTaskResponse(BaseModel):
    task_id: str
    status: str  # "pending" | "complete"
    result: dict[str, Any] | None = None


class ConfirmItem(BaseModel):
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    type: Literal["income", "expense"]
    description: str = Field("", max_length=255)
    category: str | None = None


class StatementConfirmRequest(BaseModel):
    items: list[ConfirmItem] = Field(..., min_length=1)


class ConfirmResponse(BaseModel):
    created: int
    skipped: int
    errors: list[str]


# ── Эндпоинты ───────────────────────────────────────────────────────────
@router.post(
    "/statement",
    response_model=StatementEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload a bank statement (PDF/image/Excel) for background parsing",
)
async def upload_statement(
    file: UploadFile = File(..., description="Bank statement: PDF, image or Excel"),
    current_user: User = Depends(get_current_user),
) -> StatementEnqueueResponse:
    file_name = file.filename or "statement"
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext not in _ALLOWED_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый формат: .{ext}. Разрешено: {sorted(_ALLOWED_EXT)}",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Пустой файл")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Файл больше 10 МБ",
        )

    pool = await _get_arq_pool()
    task_id = str(uuid.uuid4())
    await pool.enqueue_job(
        "parse_statement",
        current_user.id,
        base64.b64encode(content).decode("ascii"),
        file_name,
        _job_id=task_id,
    )
    return StatementEnqueueResponse(task_id=task_id, status="pending")


@router.get(
    "/{task_id}",
    response_model=StatementTaskResponse,
    summary="Poll statement parsing status → candidate transactions",
)
async def poll_statement(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> StatementTaskResponse:
    pool = await _get_arq_pool()
    job = Job(task_id, pool)
    try:
        info = await job.info()
    except Exception:
        info = None

    # Ownership: первый аргумент задачи — user_id (см. upload_statement).
    if info is None or not info.args or info.args[0] != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if isinstance(info, JobResult) and info.success and info.result is not None:
        return StatementTaskResponse(task_id=task_id, status="complete", result=info.result)
    return StatementTaskResponse(task_id=task_id, status="pending")


@router.post(
    "/confirm",
    response_model=ConfirmResponse,
    summary="Import the user-approved candidate transactions",
)
async def confirm_import(
    body: StatementConfirmRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ConfirmResponse:
    # Собираем CSV под контракт import_transactions (date, amount, category, comment).
    # Знак суммы задаёт тип для авто-создаваемых категорий; существующие категории
    # берут свой тип, а хранится всегда abs (см. import_export_service).
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "amount", "category", "comment"])
    today = date.today().isoformat()
    for item in body.items:
        signed = item.amount if item.type == "income" else -item.amount
        writer.writerow([today, str(signed), item.category or "", item.description])

    result = await import_transactions(
        session, current_user.id, buf.getvalue().encode("utf-8"), "statement.csv"
    )
    return ConfirmResponse(created=result.created, skipped=result.skipped, errors=result.errors)
