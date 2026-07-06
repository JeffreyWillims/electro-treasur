"""
Telegram Bot Middleware — DB Session & User Resolution.

Injects an async SQLAlchemy session and the current authenticated User
(resolved by telegram_chat_id) into aiogram handler data dict.

Complexity: O(1) per session acquisition. O(1) user lookup via UNIQUE index.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from src.database import async_session_factory
from src.domain.models import User

logger = logging.getLogger(__name__)


class DbSessionMiddleware(BaseMiddleware):
    """
    Outer middleware that provides DB session + resolved User to all handlers.

    Lifecycle:
      1. Open async session via async_session_factory context manager.
      2. Attempt to resolve User by telegram_chat_id (UNIQUE index hit → O(1)).
      3. Inject `session` and `current_user` (may be None if unlinked) into data.
      4. Call next handler. Session auto-committed/rolled-back on exit.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        chat_id: int | None = None

        if isinstance(event, Message):
            chat_id = event.chat.id
        elif isinstance(event, CallbackQuery) and event.message is not None:
            chat_id = event.message.chat.id

        async with async_session_factory() as session:
            data["session"] = session
            current_user: User | None = None

            if chat_id is not None:
                try:
                    # categories грузим явно: модель теперь lazy="raise_on_sql",
                    # а хендлер выбора конверта читает current_user.categories.
                    query = (
                        select(User)
                        .where(User.telegram_chat_id == chat_id)
                        .options(selectinload(User.categories))
                    )
                    result = await session.execute(query)
                    current_user = result.scalar_one_or_none()
                except Exception as exc:  # noqa: BLE001
                    logger.error("Error resolving telegram user for chat_id=%s: %s", chat_id, exc)

            data["current_user"] = current_user
            return await handler(event, data)
