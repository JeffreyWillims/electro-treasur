"""Feedback business logic — persist a user's message."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Feedback


async def save_feedback(session: AsyncSession, user_id: int, message: str) -> Feedback:
    """Персистит сообщение обратной связи и возвращает созданную строку."""
    feedback = Feedback(user_id=user_id, message=message)
    session.add(feedback)
    # commit обязателен: get_db не коммитит на teardown — без него INSERT
    # откатывался при закрытии сессии (баг «фидбек исчезает», июль 2026).
    await session.commit()
    return feedback
