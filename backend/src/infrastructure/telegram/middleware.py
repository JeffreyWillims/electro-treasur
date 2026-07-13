"""
Middleware Telegram-бота — сессия БД и определение пользователя.

Внедряет асинхронную SQLAlchemy-сессию и текущего аутентифицированного User
(определяется по telegram_chat_id) в словарь данных хендлера aiogram.

Сложность: O(1) на получение сессии. O(1) поиск пользователя через UNIQUE-индекс.
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
    Внешний middleware, предоставляющий сессию БД + определённого User всем хендлерам.

    Жизненный цикл:
      1. Открыть асинхронную сессию через контекстный менеджер async_session_factory.
      2. Попытаться определить User по telegram_chat_id (попадание в UNIQUE-индекс → O(1)).
      3. Внедрить `session` и `current_user` (может быть None, если не привязан) в data.
      4. Вызвать следующий хендлер. Сессия автоматически коммитится/откатывается при выходе.
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
