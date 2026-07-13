"""
arq Worker — проактивные Telegram-напоминалки (детерминированно, без LLM).

Задачи:
  • remind_inactive_users — «умный» ежедневный пинг тем, у кого привязан чат,
    но за сегодня ещё нет ни одной транзакции.
  • push_free_funds — недельный сигнал «свободные средства» за текущий месяц.

Регистрируется в общем WorkerSettings (см. insight_scheduler.py).
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy import select

from src.domain.models import User
from src.infrastructure.telegram import notifier
from src.services.cashflow_prep import (
    get_active_user_ids,
    get_free_funds,
    get_linked_users_without_tx_on,
)

logger = logging.getLogger(__name__)

REMINDER_TEXT = (
    "🔔 Не забудь внести сегодняшние траты — это 10 секунд. Просто пришли, например, «500 кофе»."
)


async def remind_inactive_users(ctx: dict[str, Any]) -> dict[str, Any]:
    """Cron: пинг юзерам с привязанным чатом, у кого за сегодня нет транзакций."""
    today = date.today()

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        targets = await get_linked_users_without_tx_on(session, today)

    reminded = 0
    for _user_id, chat_id in targets:
        if await notifier.send_message(chat_id, REMINDER_TEXT):
            reminded += 1

    logger.info(
        "Reminder ping sent to %d/%d users on %s", reminded, len(targets), today.isoformat()
    )
    return {"reminded": reminded, "day": today.isoformat()}


async def push_free_funds(ctx: dict[str, Any]) -> dict[str, Any]:
    """Cron: недельный DM «свободно в этом месяце» активным юзерам с чатом."""
    today = date.today()
    period_start = today.replace(day=1)

    SessionLocal = ctx["SessionLocal"]
    pushed = 0
    async with SessionLocal() as session:
        user_ids = await get_active_user_ids(session, period_start, today)
        for user_id in user_ids:
            chat_id = (
                await session.execute(select(User.telegram_chat_id).where(User.id == user_id))
            ).scalar_one_or_none()
            if chat_id is None:
                continue

            funds = await get_free_funds(session, user_id, period_start, today)
            lines = [
                f"💰 Свободно в этом месяце: {funds['free']:,.0f} ₽ "
                f"(доход {funds['income']:,.0f} − расход {funds['expense']:,.0f})"
            ]
            for env in funds["envelopes"]:
                lines.append(f"• {env['name']}: остаток {env['remaining']:,.0f} ₽")

            if await notifier.send_message(chat_id, "\n".join(lines)):
                pushed += 1

    logger.info("Free-funds push sent to %d users (%s..%s)", pushed, period_start, today)
    return {"pushed": pushed, "day": today.isoformat()}
