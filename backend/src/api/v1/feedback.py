"""
Feedback endpoints.

Отправка: сообщение сохраняется синхронно (быстрый INSERT) — раньше следом
уходило письмо, теперь обращения читаются прямо в приложении, в окне
«Обратная связь», поэтому SMTP из этого пути убран целиком.

Чтение: доступно только владельцам из ET_FEEDBACK_ADMIN_EMAILS. Пустая
настройка закрывает доступ всем — тот же принцип, что у admin_password.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.feedback import FeedbackCreate, FeedbackList, FeedbackRead
from src.services.feedback_service import (
    is_feedback_admin,
    list_feedback,
    mark_feedback_read,
    save_feedback,
)

router = APIRouter(tags=["Feedback"])


def _require_feedback_admin(current_user: User) -> None:
    """403 всем, кроме владельцев — сообщения пользователей приватны."""
    if not is_feedback_admin(current_user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для просмотра обратной связи",
        )


@router.post("/", status_code=200)
async def submit_feedback(
    payload: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    await save_feedback(db, user_id=current_user.id, message=payload.message)
    return {"status": "ok"}


@router.get("/", response_model=FeedbackList)
async def read_feedback(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackList:
    """Список обращений для окна «Обратная связь» + счётчик непрочитанных."""
    _require_feedback_admin(current_user)
    rows, unread = await list_feedback(db, limit=limit)
    items = [
        FeedbackRead(
            id=fb.id,
            message=fb.message,
            is_read=fb.is_read,
            created_at=fb.created_at,
            author_email=email,
        )
        for fb, email in rows
    ]
    return FeedbackList(items=items, unread=unread)


@router.patch("/{feedback_id}/read", status_code=200)
async def mark_one_read(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Погасить одно обращение."""
    _require_feedback_admin(current_user)
    return {"updated": await mark_feedback_read(db, feedback_id)}


@router.patch("/read-all", status_code=200)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Погасить счётчик целиком."""
    _require_feedback_admin(current_user)
    return {"updated": await mark_feedback_read(db)}
