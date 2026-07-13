"""
Financial Health Score — детерминированный индекс 0..100.

Чистая, без побочных эффектов формула (`compute_health_score`) + async-оркестратор
(`get_user_health_score`), который собирает входные числа из БД. НИКАКИХ LLM и внешних
вызовов — только Python и SQL-агрегация.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, SavingsGoal, Transaction
from src.services.analytics_service import get_analytics_profile


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def compute_health_score(
    *,
    avg_income: Decimal,
    avg_expense: Decimal,
    goals_progress_pct: float | None,
    budgets_within_limit_ratio: float | None,
) -> dict[str, Any]:
    """
    Свести четыре входа в индекс 0..100 (детерминированно, без БД).

    Веса: норма сбережений 0.5, цели 0.25, бюджеты 0.25.
    """
    # ── Фактор 1: норма сбережений (вес 0.5) ────────────────────────────
    rate = float((avg_income - avg_expense) / avg_income) if avg_income > 0 else 0.0
    savings_score = _clamp(rate / 0.20, 0.0, 1.0) * 100  # 20% нормы = 100

    # Человечный текст без отрицательных процентов («Откладывается -45% дохода»).
    if avg_income <= 0:
        savings_detail = "Пока нет данных о доходах — добавьте поступления, и оценка оживёт."
    elif rate < 0:
        savings_detail = "Расходы превышают доходы — в этом месяце отложить не получилось."
    elif rate == 0:
        savings_detail = "Доходы уходят полностью — попробуйте отложить хотя бы немного."
    else:
        savings_detail = f"Вы откладываете {rate * 100:.0f}% дохода — ориентир 20%."

    # ── Фактор 2: цели (вес 0.25) — нейтрально 60, если целей нет ────────
    goals_score = goals_progress_pct if goals_progress_pct is not None else 60.0

    # ── Фактор 3: бюджеты (вес 0.25) — нейтрально 60, если бюджетов нет ──
    budget_score = (
        budgets_within_limit_ratio * 100 if budgets_within_limit_ratio is not None else 60.0
    )

    total = round(0.5 * savings_score + 0.25 * goals_score + 0.25 * budget_score)

    if total >= 80:
        grade = "Отличное"
    elif total >= 60:
        grade = "Хорошее"
    elif total >= 40:
        grade = "Среднее"
    else:
        grade = "Требует внимания"

    return {
        "score": int(total),
        "grade": grade,
        "factors": [
            {
                "name": "Норма сбережений",
                "score": round(savings_score),
                "weight": 0.5,
                "detail": savings_detail,
            },
            {
                "name": "Цели",
                "score": round(goals_score),
                "weight": 0.25,
                "detail": (
                    f"Цели пройдены в среднем на {goals_progress_pct:.0f}% — так держать."
                    if goals_progress_pct is not None
                    else "Целей пока нет — поставьте первую, это плюс к оценке."
                ),
            },
            {
                "name": "Бюджеты",
                "score": round(budget_score),
                "weight": 0.25,
                "detail": (
                    f"В лимит уложились {budgets_within_limit_ratio * 100:.0f}% бюджетов месяца."
                    if budgets_within_limit_ratio is not None
                    else "Бюджетов пока нет — заведите конверты, и оценка станет точнее."
                ),
            },
        ],
    }


async def _goals_progress_pct(session: AsyncSession, user_id: int) -> float | None:
    """Средний прогресс min(current/target*100, 100) по целям; None, если целей нет."""
    stmt = select(SavingsGoal).where(SavingsGoal.user_id == user_id)
    goals = (await session.scalars(stmt)).all()
    if not goals:
        return None
    pcts = [
        min(float(g.current_amount / g.target_amount * 100), 100.0)
        for g in goals
        if g.target_amount > 0
    ]
    if not pcts:
        return None
    return sum(pcts) / len(pcts)


async def _budgets_within_limit_ratio(session: AsyncSession, user_id: int) -> float | None:
    """Доля бюджетов текущего месяца, уложившихся в лимит; None, если бюджетов нет."""
    today = date.today()

    budget_stmt = select(Budget).where(
        Budget.user_id == user_id,
        Budget.month == today.month,
        Budget.year == today.year,
    )
    budgets = (await session.scalars(budget_stmt)).all()
    if not budgets:
        return None

    # Расход по каждой категории за текущий месяц (только expense-категории).
    range_start = datetime.combine(today.replace(day=1), time.min, tzinfo=UTC)
    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)
    range_end = datetime.combine(next_month, time.min, tzinfo=UTC)

    spent_stmt = (
        select(Transaction.category_id, func.sum(Transaction.amount))
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Category.type == CategoryType.expense,
            Transaction.executed_at >= range_start,
            Transaction.executed_at < range_end,
        )
        .group_by(Transaction.category_id)
    )
    spent_rows = (await session.execute(spent_stmt)).all()
    spent: dict[int, Decimal] = {row[0]: (row[1] or Decimal("0.00")) for row in spent_rows}

    within = sum(1 for b in budgets if spent.get(b.category_id, Decimal("0.00")) <= b.amount_limit)
    return within / len(budgets)


async def get_user_health_score(session: AsyncSession, user_id: int) -> dict[str, Any]:
    """Собрать входы из БД и вернуть результат compute_health_score."""
    profile = await get_analytics_profile(session, user_id)
    avg_income = profile.avg_income
    avg_expense = sum((c.avg_amount for c in profile.categories), Decimal("0"))

    goals_progress_pct = await _goals_progress_pct(session, user_id)
    budgets_ratio = await _budgets_within_limit_ratio(session, user_id)

    return compute_health_score(
        avg_income=avg_income,
        avg_expense=avg_expense,
        goals_progress_pct=goals_progress_pct,
        budgets_within_limit_ratio=budgets_ratio,
    )
