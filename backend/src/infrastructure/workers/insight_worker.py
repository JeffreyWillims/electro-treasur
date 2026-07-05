"""
arq Worker — Static Insight Pre-calculation (Rule-Based, без LLM).

Задача `calculate_static_insights`: достаёт транзакции и бюджеты пользователя
за текущий месяц, прогоняет через RuleBasedInsightEngine (чистая память,
микросекунды) и сохраняет готовый текст в таблицу `insights`.

Фронтенд читает уже готовую строку через GET /api/v1/insights/latest —
0 мс генерации в момент открытия плашки, нулевая LLM-нагрузка на сервер.

Регистрируется в общем WorkerSettings (см. llm_worker.py) — отдельный
процесс не нужен.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy import func, select

from src.domain.models import Budget, Category, Transaction
from src.services.cashflow_prep import upsert_insight
from src.services.insight_engine import (
    BudgetData,
    RuleBasedInsightEngine,
    TransactionData,
)

logger = logging.getLogger(__name__)

MODEL_NAME = "rule-based-v1"


async def calculate_static_insights(
    ctx: dict[str, Any],
    user_id: int,
    start_date_str: str | None = None,
    end_date_str: str | None = None,
) -> dict[str, Any]:
    """
    arq task: пересчитать статический инсайт пользователя за период.

    Без явного периода берётся текущий месяц (с 1-го числа по сегодня);
    месячный cron-фан-аут передаёт прошлый полный месяц. Данные →
    RuleBasedInsightEngine → upsert в `insights` (идемпотентно по
    (user, period), повторный запуск просто перезаписывает текст).
    """
    today = date.today()
    period_start = date.fromisoformat(start_date_str) if start_date_str else today.replace(day=1)
    period_end = date.fromisoformat(end_date_str) if end_date_str else today

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
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
    }
