from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

# Добавлен импорт Query
from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rate_limit import limiter
from src.dependencies import get_current_user, get_db, get_redis_client
from src.domain.models import User
from src.schemas.transaction import (
    TransactionCreate,
    TransactionPaginatedResponse,
    TransactionResponse,
    TransactionUpdate,
)
from src.services.import_export_service import (
    export_transactions_csv,
    import_transactions,
)
from src.services.transaction_service import (
    create_transaction,
    delete_transaction,
    list_transactions,
    update_transaction,
)

router = APIRouter(tags=["Transactions"])


@router.post(
    "/",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a transaction (idempotent)",
    description=(
        "Idempotency-Key header is optional but recommended. "
        "Duplicate keys within 24h return the cached response without DB write."
    ),
)
async def post_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
    current_user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> TransactionResponse:

    return await create_transaction(
        session=session,
        redis=redis,
        user_id=current_user.id,
        payload=payload,
        idempotency_key=idempotency_key,
    )


@router.get("/", response_model=TransactionPaginatedResponse)
async def get_transactions(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    # 🔒 ХИРУРГИЧЕСКАЯ ЗАЩИТА: Ограничение пагинации сверху (Max 100)
    limit: int = Query(10, ge=1, le=100, description="Max 100 transactions per page"),
    # Верхняя граница offset: без неё клиент может запросить offset=10_000_000 —
    # Postgres всё равно материализует и отбрасывает все строки до него
    # (deep-pagination O(offset)) → тяжёлый запрос на ровном месте. Для более
    # глубокого доступа есть фильтры/поиск (в идеале — keyset-пагинация).
    offset: int = Query(0, ge=0, le=100_000, description="Max offset 100000"),
    category_id: int | None = None,
    type: str | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
) -> TransactionPaginatedResponse:
    """
    Retrieve transactions for the authenticated user.
    """
    return await list_transactions(
        session=session,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        category_id=category_id,
        tx_type=type,
        min_amount=min_amount,
        max_amount=max_amount,
        start_date=start_date,
        end_date=end_date,
        search=search,
    )


# ── Data Vault: экспорт / импорт ────────────────────────────────────────────────

_MAX_IMPORT_BYTES = 10 * 1024 * 1024  # жёсткий лимит 10 МБ
_ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


@router.get("/export", summary="Export all transactions as CSV")
async def export_transactions(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    buffer = await export_transactions_csv(session, user_id=current_user.id)
    today = datetime.now().strftime("%Y-%m-%d")

    return StreamingResponse(
        content=buffer,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="citrine_vault_{today}.csv"',
        },
    )


@router.post("/import", summary="Import transactions from CSV/Excel")
# Парсинг CSV/Excel + dedup — тяжёлая синхронная работа. Без лимита заливка
# файлов пачкой блокирует пул воркеров/БД. Тот же порог, что и на /imports/statement.
@limiter.limit("10/minute")
async def import_transactions_endpoint(
    request: Request,
    file: UploadFile = File(..., description="CSV or Excel file with transactions"),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:

    # Проверяем расширение
    filename = file.filename or "unknown.csv"
    ext = "." + filename.rsplit(".", maxsplit=1)[-1].lower() if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый формат файла. Допустимые: {', '.join(_ALLOWED_EXTENSIONS)}",
        )

    # 🔒 ХИРУРГИЧЕСКАЯ ЗАЩИТА: O(1) Pre-check размера через HTTP Header (защита от OOM)
    if file.size is not None and file.size > _MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл слишком большой. Максимальный размер: {_MAX_IMPORT_BYTES // (1024 * 1024)} МБ.",
        )

    # Read file safely (только если прошел предварительную проверку)
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Файл слишком большой. Максимальный размер: {_MAX_IMPORT_BYTES // (1024 * 1024)} МБ.",
        )

    result = await import_transactions(
        session=session,
        user_id=current_user.id,
        file_bytes=file_bytes,
        filename=filename,
    )

    return {
        "created": result.created,
        "skipped": result.skipped,
        "errors": result.errors,
    }


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def patch_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:

    resp = await update_transaction(
        session=session,
        transaction_id=transaction_id,
        user_id=current_user.id,
        payload=payload,
    )
    if resp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or not authorized",
        )
    return resp


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_endpoint(
    transaction_id: int,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a transaction.
    """
    success = await delete_transaction(
        session=session, transaction_id=transaction_id, user_id=current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or not authorized",
        )
