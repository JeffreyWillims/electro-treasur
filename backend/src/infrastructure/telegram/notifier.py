"""
Переиспользуемая отправка сообщений в Telegram (без LLM).

Единая точка построения `Bot` (с прокси, если задан `telegram_proxy_url`) для
фоновых воркеров-напоминалок. Доставка «best-effort»: любая ошибка ловится и
логируется, наружу исключение не пробрасывается — упавший пуш не роняет джобу.
"""

from __future__ import annotations

import logging

from aiogram import Bot
from aiogram.client.session.aiohttp import AiohttpSession

from src.config import settings

logger = logging.getLogger(__name__)


async def send_message(chat_id: int, text: str) -> bool:
    """Шлёт `text` в чат `chat_id`. True при успехе, False при любой ошибке."""
    if not settings.telegram_bot_token:
        logger.info("Telegram send skipped: bot token not configured")
        return False

    if settings.telegram_proxy_url:
        bot = Bot(
            token=settings.telegram_bot_token,
            session=AiohttpSession(proxy=settings.telegram_proxy_url),
        )
    else:
        bot = Bot(token=settings.telegram_bot_token)
    try:
        await bot.send_message(chat_id, text)
        return True
    except Exception as exc:  # noqa: BLE001 — юзер мог заблокировать бота
        logger.warning("Telegram send failed for chat_id=%d: %s", chat_id, exc)
        return False
    finally:
        await bot.session.close()
