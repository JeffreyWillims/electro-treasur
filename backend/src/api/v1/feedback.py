"""
Feedback endpoint.

Сообщение сохраняется синхронно (быстрый INSERT), а «отправка письма» —
медленная/внешняя часть — уходит в фон через BackgroundTasks, поэтому клиент
мгновенно получает {"status": "ok"}, не дожидаясь SMTP.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.feedback import FeedbackCreate
from src.services.email_service import EmailService
from src.services.feedback_service import save_feedback

router = APIRouter(tags=["Feedback"])


@router.post("/", status_code=200)
async def submit_feedback(
    payload: FeedbackCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    await save_feedback(db, user_id=current_user.id, message=payload.message)
    # Медленная «отправка письма» — в фон, ответ клиенту не блокируется.
    background_tasks.add_task(EmailService.send_feedback, current_user.email, payload.message)
    return {"status": "ok"}
