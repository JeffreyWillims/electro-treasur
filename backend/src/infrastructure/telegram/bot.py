"""
Telegram Bot Entry Point — Citrine Vault.

Lifecycle:
  1. Instantiate Bot with token from centralized settings.
  2. Instantiate Dispatcher (no FSM storage needed for stateless commands).
  3. Create shared async Redis client and inject into Dispatcher workflow data.
  4. Register DbSessionMiddleware as outer middleware on both message and
     callback_query observers (covers all update types the bot handles).
  5. Include the command router.
  6. Start long-polling. On shutdown: close Redis + Bot session gracefully.

Usage (local):
    python -m src.infrastructure.telegram.bot

Usage (Docker):
    command: python -m src.infrastructure.telegram.bot
"""

from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from redis.asyncio import Redis

from src.config import settings
from src.infrastructure.telegram.handlers import router
from src.infrastructure.telegram.middleware import DbSessionMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    logger.info("🚀 Initializing Citrine Vault Telegram Service...")

    if not settings.telegram_bot_token:
        logger.critical(
            "ET_TELEGRAM_BOT_TOKEN is not set. Set it in .env and restart the service."
        )
        return

    bot = Bot(token=settings.telegram_bot_token)
    dp = Dispatcher()

    # Shared Redis client — injected via dp workflow_data so handlers can
    # receive it as `redis_client` parameter via aiogram's DI system.
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    dp["redis_client"] = redis_client

    # Outer middlewares — execute before any handler, guaranteed session scope.
    db_middleware = DbSessionMiddleware()
    dp.message.outer_middleware(db_middleware)
    dp.callback_query.outer_middleware(db_middleware)

    dp.include_router(router)

    try:
        logger.info("✅ Bot online. Listening for updates via long-polling...")
        await dp.start_polling(bot, allowed_updates=["message", "callback_query"])
    finally:
        logger.info("🛑 Shutting down Citrine Vault Telegram Service...")
        await redis_client.aclose()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
