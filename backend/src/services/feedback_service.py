"""Feedback business logic — persist and read users' messages."""

from __future__ import annotations

from typing import Any, cast

from sqlalchemy import func, select, update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.domain.models import Feedback, User


async def save_feedback(session: AsyncSession, user_id: int, message: str) -> Feedback:
    """Персистит сообщение обратной связи и возвращает созданную строку."""
    feedback = Feedback(user_id=user_id, message=message)
    session.add(feedback)
    # commit обязателен: get_db не коммитит на teardown — без него INSERT
    # откатывался при закрытии сессии (баг «фидбек исчезает», июль 2026).
    await session.commit()
    return feedback


def is_feedback_admin(email: str) -> bool:
    """Видит ли этот email окно «Обратная связь». Пустая настройка — никто."""
    allowed = {
        item.strip().lower() for item in settings.feedback_admin_emails.split(",") if item.strip()
    }
    return bool(allowed) and email.strip().lower() in allowed


async def list_feedback(
    session: AsyncSession, limit: int = 100
) -> tuple[list[tuple[Feedback, str]], int]:
    """Свежие обращения с email автора + число непрочитанных.

    Автор подтягивается одним JOIN — без него список делал бы запрос на строку.
    """
    rows = (
        await session.execute(
            select(Feedback, User.email)
            .join(User, User.id == Feedback.user_id)
            .order_by(Feedback.created_at.desc())
            .limit(limit)
        )
    ).all()
    unread = (
        await session.execute(
            select(func.count()).select_from(Feedback).where(Feedback.is_read.is_(False))
        )
    ).scalar_one()
    return [(row[0], row[1]) for row in rows], unread


async def mark_feedback_read(session: AsyncSession, feedback_id: int | None = None) -> int:
    """Отмечает прочитанным одно обращение или все. Возвращает число изменённых."""
    stmt = update(Feedback).where(Feedback.is_read.is_(False)).values(is_read=True)
    if feedback_id is not None:
        stmt = stmt.where(Feedback.id == feedback_id)
    result = cast("CursorResult[Any]", await session.execute(stmt))
    await session.commit()
    return result.rowcount or 0
