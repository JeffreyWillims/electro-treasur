"""Pydantic V2-схема сообщения обратной связи от пользователя."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FeedbackCreate(BaseModel):
    """POST /api/v1/feedback body."""

    message: str = Field(..., min_length=1, max_length=2000)


class FeedbackRead(BaseModel):
    """Строка списка в окне «Обратная связь» (GET /api/v1/feedback/)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    message: str
    is_read: bool
    created_at: datetime
    author_email: str


class FeedbackList(BaseModel):
    """Ответ списка: сами обращения и счётчик непрочитанных."""

    items: list[FeedbackRead]
    unread: int
