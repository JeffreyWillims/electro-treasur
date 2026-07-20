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
from datetime import UTC, date, datetime
from typing import Any

from src.infrastructure.telegram import notifier
from src.services.cashflow_prep import (
    get_active_users_with_chat,
    get_free_funds,
    get_linked_users_without_tx_on,
)

logger = logging.getLogger(__name__)

# Напоминание-предложение записать траты за день. Пишем как живой человек:
# тон зависит от времени суток, а текст чередуется по дню года — чтобы один и
# тот же пинг не приходил изо дня в день. Cron шлёт в 10:00 и 19:00 UTC
# (13:00 и 22:00 МСК), поэтому вечерним считаем всё, что позже 17:00 UTC.
EVENING_FROM_HOUR_UTC = 17

DAY_REMINDERS = (
    "Привет! Если сегодня уже были покупки — давай запишем, пока помнится. "
    "Можно прямо сюда одной строкой: «500 кофе».",
    "Загляну на минутку: что-нибудь потратилось с утра? "
    "Пришли сюда, например «300 обед», — я всё занесу.",
    "Как проходит день? Если были траты, отправь их парой слов — "
    "вроде «1200 продукты». Это займёт секунд десять.",
    "Небольшой чек-ин: расходы за сегодня уже записаны? "
    "Если нет — просто напиши сумму и на что, например «250 такси».",
)

EVENING_REMINDERS = (
    "Добрый вечер! День почти закрыт — давай зафиксируем сегодняшние траты, "
    "пока они свежи в памяти. Например: «500 кофе».",
    "Вечерний ритуал на десять секунд: запиши, что потратил за день. "
    "Одной строкой — «1200 продукты».",
    "Подведём итог дня? Отправь траты одним сообщением, вроде «300 обед», "
    "и можно спокойно отдыхать.",
    "Перед сном короткая сверка: если сегодня были расходы, пришли их сюда — "
    "например «250 такси». Завтра скажешь себе спасибо.",
)


def build_reminder_text(now: datetime) -> str:
    """Тёплое напоминание записать траты: вечером — про итог дня, днём — лёгкий пинг."""
    pool = EVENING_REMINDERS if now.hour >= EVENING_FROM_HOUR_UTC else DAY_REMINDERS
    return pool[now.timetuple().tm_yday % len(pool)]


async def remind_inactive_users(ctx: dict[str, Any]) -> dict[str, Any]:
    """Cron: пинг юзерам с привязанным чатом, у кого за сегодня нет транзакций."""
    today = date.today()
    text = build_reminder_text(datetime.now(UTC))

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        targets = await get_linked_users_without_tx_on(session, today)

    reminded = 0
    for _user_id, chat_id in targets:
        if await notifier.send_message(chat_id, text):
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
        # Один запрос вместо SELECT chat_id на каждого активного пользователя:
        # заодно из выборки сразу выпадают те, кому отправить всё равно нечем.
        targets = await get_active_users_with_chat(session, period_start, today)
        for user_id, chat_id in targets:
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
