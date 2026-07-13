"""
Точка входа Telegram-бота — Citrine Vault.

Жизненный цикл:
  1. Создать Bot с токеном из централизованных настроек.
  2. Создать Dispatcher (FSM-хранилище не нужно для stateless-команд).
  3. Создать общий асинхронный Redis-клиент и внедрить его в workflow data Dispatcher.
  4. Зарегистрировать DbSessionMiddleware как внешний middleware для observers
     message и callback_query (покрывает все типы обновлений, обрабатываемые ботом).
  5. Подключить роутер команд.
  6. Запустить long-polling. При остановке: аккуратно закрыть Redis + сессию Bot.

Использование (локально):
    python -m src.infrastructure.telegram.bot

Использование (Docker):
    command: python -m src.infrastructure.telegram.bot
"""

from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession
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

    dp = Dispatcher()

    if settings.telegram_proxy_url:
        logger.info(f"🌐 Подключаем Telegram через прокси: {settings.telegram_proxy_url}")

        # Передаем прокси напрямую в сессию, без aiohttp-socks
        session = AiohttpSession(proxy=settings.telegram_proxy_url)
        bot = Bot(token=settings.telegram_bot_token, session=session)
    else:
        logger.info("📡 Запуск Telegram без прокси")
        bot = Bot(token=settings.telegram_bot_token)
    # Общий Redis-клиент — внедряется через dp workflow_data, чтобы хендлеры
    # могли получать его как параметр `redis_client` через DI-систему aiogram.
    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    dp["redis_client"] = redis_client

    # Внешние middleware — выполняются перед любым хендлером, гарантированная область видимости сессии.
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
