"""
arq Worker — Static Insight Pre-calculation (Rule-Based, без LLM).

Задача `calculate_static_insights`: достаёт транзакции и бюджеты пользователя
за текущий месяц, прогоняет через RuleBasedInsightEngine (чистая память,
микросекунды) и сохраняет готовый текст в таблицу `insights`.

Фронтенд читает уже готовую строку через GET /api/v1/insights/latest —
0 мс генерации в момент открытия плашки, нулевая LLM-нагрузка на сервер.

Cron `schedule_weekly_push` (воскресенье 18:00 UTC) раз в неделю пересчитывает
инсайт за текущий месяц и с notify=True пушит его прямо в Telegram юзера —
Zero-Friction: советы приходят сами, без захода в приложение.

Регистрируется в общем WorkerSettings (см. llm_worker.py) — отдельный
процесс не нужен.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import Any

from aiogram import Bot
from aiogram.client.session.aiohttp import AiohttpSession
from arq.connections import ArqRedis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.domain.models import Budget, Category, Transaction, User
from src.services.cashflow_prep import get_active_user_ids, upsert_insight
from src.services.insight_engine import (
    BudgetData,
    RuleBasedInsightEngine,
    TransactionData,
)

logger = logging.getLogger(__name__)

MODEL_NAME = "rule-based-v1"


async def build_insight_for_period(
    session: AsyncSession, user_id: int, period_start: date, period_end: date
) -> tuple[str, Decimal, Decimal]:
    """
    (advice, income, expense) за период: транзакции + бюджеты месяца периода
    → RuleBasedInsightEngine. Общий строитель для cron-задач и кнопки «AI Анализ».
    """
    tx_stmt = (
        select(
            Transaction.amount,
            Transaction.category_id,
            Category.type,
            Transaction.executed_at,
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            func.date(Transaction.executed_at) >= period_start,
            func.date(Transaction.executed_at) <= period_end,
        )
    )
    transactions = [
        TransactionData(
            amount=amount,
            category_id=category_id,
            category_type=category_type,
            executed_at=executed_at,
        )
        for amount, category_id, category_type, executed_at in (
            await session.execute(tx_stmt)
        ).all()
    ]

    budget_stmt = (
        select(Budget.category_id, Category.name, Budget.amount_limit)
        .join(Category, Budget.category_id == Category.id)
        .where(
            Budget.user_id == user_id,
            Budget.month == period_start.month,
            Budget.year == period_start.year,
        )
    )
    budgets = [
        BudgetData(category_id=category_id, category_name=name, amount_limit=limit)
        for category_id, name, limit in (await session.execute(budget_stmt)).all()
    ]

    engine = RuleBasedInsightEngine()
    advice = engine.generate(transactions, budgets)
    income, expense = engine.cashflow_totals(transactions)
    return advice, income, expense


async def _send_telegram_insight(chat_id: int, advice: str) -> bool:
    """Пуш готового инсайта в Telegram. Ошибка доставки не роняет джобу."""
    if not settings.telegram_bot_token:
        logger.info("Telegram push skipped: bot token not configured")
        return False

    if settings.telegram_proxy_url:
        bot = Bot(
            token=settings.telegram_bot_token,
            session=AiohttpSession(proxy=settings.telegram_proxy_url),
        )
    else:
        bot = Bot(token=settings.telegram_bot_token)
    try:
        await bot.send_message(chat_id, f"📬 Ваш еженедельный финансовый пульс:\n\n{advice}")
        return True
    except Exception as exc:  # noqa: BLE001 — юзер мог заблокировать бота
        logger.warning("Telegram push failed for chat_id=%d: %s", chat_id, exc)
        return False
    finally:
        await bot.session.close()


async def calculate_static_insights(
    ctx: dict[str, Any],
    user_id: int,
    start_date_str: str | None = None,
    end_date_str: str | None = None,
    notify: bool = False,
) -> dict[str, Any]:
    """
    arq task: пересчитать статический инсайт пользователя за период.

    Без явного периода берётся текущий месяц (с 1-го числа по сегодня);
    месячный cron-фан-аут передаёт прошлый полный месяц. Данные →
    RuleBasedInsightEngine → upsert в `insights` (идемпотентно по
    (user, period), повторный запуск просто перезаписывает текст).
    С notify=True готовый текст дополнительно пушится в Telegram юзера.
    """
    today = date.today()
    period_start = date.fromisoformat(start_date_str) if start_date_str else today.replace(day=1)
    period_end = date.fromisoformat(end_date_str) if end_date_str else today

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        advice, income, expense = await build_insight_for_period(
            session, user_id, period_start, period_end
        )

        await upsert_insight(
            session,
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            advice=advice,
            summary={
                "total_income": str(income),
                "total_expense": str(expense),
                "saved": str(income - expense),
            },
            model_used=MODEL_NAME,
        )
        await session.commit()

        telegram_chat_id: int | None = None
        if notify:
            telegram_chat_id = (
                await session.execute(select(User.telegram_chat_id).where(User.id == user_id))
            ).scalar_one_or_none()

    # Пуш после commit: инсайт в БД уже сохранён, даже если доставка упадёт.
    notified = False
    if notify and telegram_chat_id is not None:
        notified = await _send_telegram_insight(telegram_chat_id, advice)

    logger.info(
        "Static insight persisted user=%d %s..%s",
        user_id,
        period_start.isoformat(),
        period_end.isoformat(),
    )
    return {
        "user_id": user_id,
        "period": [period_start.isoformat(), period_end.isoformat()],
        "advice": advice,
        "model_used": MODEL_NAME,
        "notified": notified,
    }


async def schedule_weekly_push(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Cron (воскресенье 18:00 UTC): фан-аут инсайта за текущий месяц по всем
    активным юзерам с notify=True — итоги недели приходят прямо в Telegram.
    """
    today = date.today()
    period_start = today.replace(day=1)

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        user_ids = await get_active_user_ids(session, period_start, today)

    pool: ArqRedis = ctx["arq_pool"]
    for user_id in user_ids:
        await pool.enqueue_job(
            "calculate_static_insights",
            user_id,
            period_start.isoformat(),
            today.isoformat(),
            True,
        )

    logger.info(
        "Weekly Telegram push scheduled for %d users (%s..%s)",
        len(user_ids),
        period_start.isoformat(),
        today.isoformat(),
    )
    return {
        "scheduled": len(user_ids),
        "period": [period_start.isoformat(), today.isoformat()],
    }
