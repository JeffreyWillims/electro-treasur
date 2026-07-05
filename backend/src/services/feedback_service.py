"""Feedback business logic — persist a user's message."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Feedback


async def save_feedback(session: AsyncSession, user_id: int, message: str) -> Feedback:
    """Персистит сообщение обратной связи и возвращает созданную строку."""
    feedback = Feedback(user_id=user_id, message=message)
    session.add(feedback)
    await session.flush()
    return feedback
