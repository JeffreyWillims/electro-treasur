"""Pydantic V2 schemas — уведомления колокольчика."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    """Одно уведомление ленты."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime


class NotificationList(BaseModel):
    """GET /v1/notifications — лента + счётчик непрочитанного для бейджа."""

    items: list[NotificationOut]
    unread: int
