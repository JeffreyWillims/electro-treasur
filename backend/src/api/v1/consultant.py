"""
CONSULTANT role API — RBAC multi-tenancy.

Две стороны моста:
  • Клиент управляет грантами: выдать/отозвать доступ по email консультанта.
    Грант создаёт ТОЛЬКО клиент — консультант не может выдать себе доступ сам.
  • Консультант (роль CONSULTANT, гейт require_consultant) читает список своих
    клиентов и их транзакции. Доступ строго Read-Only: эндпоинтов записи нет.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db, require_consultant
from src.domain.models import ConsultantAccess, User, UserRole
from src.schemas.consultant import ClientInfo, GrantAccessRequest, GrantInfo
from src.schemas.transaction import TransactionPaginatedResponse
from src.services.transaction_service import list_transactions

router = APIRouter(tags=["Consultant (RBAC)"])


# ── Сторона клиента: управление грантами ────────────────────────────────


@router.post("/access", status_code=status.HTTP_201_CREATED)
async def grant_access(
    body: GrantAccessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Клиент выдаёт консультанту read-only доступ к своим транзакциям."""
    result = await db.execute(select(User).where(User.email == body.consultant_email))
    consultant = result.scalar_one_or_none()
    if consultant is None or consultant.role != UserRole.consultant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Консультант с таким email не найден",
        )
    if consultant.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя выдать доступ самому себе",
        )

    # Идемпотентно: повторный грант той же паре — no-op.
    stmt = (
        insert(ConsultantAccess)
        .values(consultant_id=consultant.id, client_id=current_user.id)
        .on_conflict_do_nothing(constraint="uq_consultant_client")
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "granted", "consultant_email": consultant.email}


@router.delete("/access", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_access(
    body: GrantAccessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Клиент отзывает ранее выданный грант."""
    result = await db.execute(select(User.id).where(User.email == body.consultant_email))
    consultant_id = result.scalar_one_or_none()
    if consultant_id is not None:
        await db.execute(
            delete(ConsultantAccess).where(
                ConsultantAccess.consultant_id == consultant_id,
                ConsultantAccess.client_id == current_user.id,
            )
        )
        await db.commit()


@router.get("/access", response_model=list[GrantInfo])
async def list_grants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GrantInfo]:
    """Клиент видит, каким консультантам он выдал доступ."""
    stmt = (
        select(ConsultantAccess.consultant_id, User.email, ConsultantAccess.created_at)
        .join(User, ConsultantAccess.consultant_id == User.id)
        .where(ConsultantAccess.client_id == current_user.id)
        .order_by(ConsultantAccess.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    return [
        GrantInfo(consultant_id=cid, consultant_email=email, created_at=created)
        for cid, email, created in rows
    ]


# ── Сторона консультанта: Read-Only доступ ──────────────────────────────


@router.get("/clients", response_model=list[ClientInfo])
async def list_clients(
    db: AsyncSession = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> list[ClientInfo]:
    """Список клиентов, выдавших консультанту доступ."""
    stmt = (
        select(User)
        .join(ConsultantAccess, ConsultantAccess.client_id == User.id)
        .where(ConsultantAccess.consultant_id == consultant.id)
        .order_by(User.id)
    )
    clients = (await db.execute(stmt)).scalars().all()
    return [ClientInfo.model_validate(c) for c in clients]


@router.get("/clients/{client_id}/transactions", response_model=TransactionPaginatedResponse)
async def client_transactions(
    client_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    consultant: User = Depends(require_consultant),
) -> TransactionPaginatedResponse:
    """Read-only транзакции клиента. 404 без действующего гранта (не раскрываем, существует ли клиент)."""
    grant = await db.execute(
        select(ConsultantAccess.id).where(
            ConsultantAccess.consultant_id == consultant.id,
            ConsultantAccess.client_id == client_id,
        )
    )
    if grant.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    return await list_transactions(db, user_id=client_id, limit=limit, offset=offset)
