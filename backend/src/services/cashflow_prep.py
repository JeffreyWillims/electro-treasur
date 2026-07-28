"""
Cashflow analysis preparation — helpers for the monthly insight pipeline.

Pure helpers (period math) are unit-testable without a DB.
The two async helpers wrap the DB access the fan-out worker needs:
  • which users to analyse for a period,
  • how to persist the final insight idempotently.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import distinct, exists, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, Insight, Transaction, User


def previous_month_range(today: date) -> tuple[date, date]:
    """First and last calendar day of the month preceding `today` (both inclusive)."""
    first_of_this_month = today.replace(day=1)
    last_prev = first_of_this_month - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    return first_prev, last_prev


async def get_active_user_ids(session: AsyncSession, start: date, end: date) -> list[int]:
    """User IDs with at least one transaction in [start, end] (inclusive by date).

    Matches get_monthly_dashboard's date filter so scheduling and aggregation
    agree on what "active this month" means.
    """
    # Sargable-диапазон вместо func.date(executed_at): это глобальный (без user_id)
    # запрос по всей таблице, и обёртка func.date() вокруг колонки не даёт
    # использовать b-tree по executed_at → seq scan всей transactions + сортировка
    # под distinct. Полуоткрытый интервал [start, end+1day) эквивалентен
    # включительному по датам и опирается на индекс. Заодно уходит зависимость
    # от серверной TZ внутри func.date (сравниваем сам timestamp).
    stmt = (
        select(distinct(Transaction.user_id))
        .where(
            Transaction.executed_at >= start,
            Transaction.executed_at < end + timedelta(days=1),
        )
        .order_by(Transaction.user_id)
    )
    result = await session.execute(stmt)
    return [row[0] for row in result.all()]


async def upsert_insight(
    session: AsyncSession,
    user_id: int,
    period_start: date,
    period_end: date,
    advice: str,
    summary: dict[str, Any],
    model_used: str,
) -> None:
    """Insert or overwrite the insight for (user, period) — idempotent re-runs."""
    stmt = insert(Insight).values(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        advice=advice,
        summary=summary,
        model_used=model_used,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_insight_user_period",
        set_={
            "advice": stmt.excluded.advice,
            "summary": stmt.excluded.summary,
            "model_used": stmt.excluded.model_used,
            "created_at": func.now(),
        },
    )
    await session.execute(stmt)


async def get_linked_users_without_tx_on(
    session: AsyncSession, day: date
) -> list[tuple[int, int]]:
    """(user_id, telegram_chat_id) юзеров с привязанным чатом и без транзакций за `day`.

    Кандидаты на «умный пинг»: telegram_chat_id задан, но за `day` нет ни одной
    транзакции (NOT EXISTS по дате executed_at).
    """
    # Sargable-диапазон вместо func.date(...) == day: функция над колонкой в
    # коррелированном EXISTS не даёт использовать индекс (user_id, executed_at).
    # Полуоткрытый интервал [day; day+1) эквивалентен «за этот день» и опирается
    # на индекс (как в get_active_user_ids).
    has_tx_today = exists().where(
        Transaction.user_id == User.id,
        Transaction.executed_at >= day,
        Transaction.executed_at < day + timedelta(days=1),
    )
    stmt = (
        select(User.id, User.telegram_chat_id)
        .where(User.telegram_chat_id.is_not(None), ~has_tx_today)
        .order_by(User.id)
    )
    result = await session.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]


async def get_category_expense(
    session: AsyncSession, user_id: int, start: date, end: date
) -> dict[str, Decimal]:
    """{название категории: сумма расходов} за период — вход психопаспорта.

    Общая точка для месячного воркера и эндпоинта /analytics/psychopassport:
    иначе два места считали бы «расход по категориям» каждое по-своему.
    """
    stmt = (
        select(Category.name, func.sum(Transaction.amount))
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Category.type == CategoryType.expense,
            func.date(Transaction.executed_at) >= start,
            func.date(Transaction.executed_at) <= end,
        )
        .group_by(Category.name)
    )
    return {name: total for name, total in (await session.execute(stmt)).all()}


async def get_active_users_with_chat(
    session: AsyncSession, start: date, end: date
) -> list[tuple[int, int]]:
    """(user_id, telegram_chat_id) активных за период юзеров с привязанным чатом.

    Пара к get_active_user_ids: сразу отсекает тех, кому всё равно не отправить,
    и отдаёт chat_id тем же запросом — иначе рассылка делала SELECT на каждого
    пользователя в цикле (N+1).
    """
    # Sargable-диапазон вместо func.date(...) в EXISTS: [start; end+1) использует
    # индекс (user_id, executed_at), в отличие от функции над колонкой.
    has_tx = exists().where(
        Transaction.user_id == User.id,
        Transaction.executed_at >= start,
        Transaction.executed_at < end + timedelta(days=1),
    )
    stmt = (
        select(User.id, User.telegram_chat_id)
        .where(User.telegram_chat_id.is_not(None), has_tx)
        .order_by(User.id)
    )
    result = await session.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]


async def get_period_totals(
    session: AsyncSession, user_id: int, start: date, end: date
) -> tuple[Decimal, Decimal]:
    """(доход, расход) за период — суммы транзакций по типу категории."""
    stmt = (
        select(Category.type, func.coalesce(func.sum(Transaction.amount), 0))
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            func.date(Transaction.executed_at) >= start,
            func.date(Transaction.executed_at) <= end,
        )
        .group_by(Category.type)
    )
    income = Decimal("0")
    expense = Decimal("0")
    for ctype, total in (await session.execute(stmt)).all():
        if ctype == CategoryType.income:
            income = total
        elif ctype == CategoryType.expense:
            expense = total
    return income, expense


async def get_free_funds(
    session: AsyncSession, user_id: int, start: date, end: date
) -> dict[str, Any]:
    """Свободные средства за [start, end]: доход − расход + остатки по конвертам.

    income/expense — суммы транзакций по типу категории. `envelopes` — по бюджетам
    месяца (start.month, start.year): remaining = amount_limit − факт по категории.
    """
    income, expense = await get_period_totals(session, user_id, start, end)

    spent_stmt = (
        select(Transaction.category_id, func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            func.date(Transaction.executed_at) >= start,
            func.date(Transaction.executed_at) <= end,
        )
        .group_by(Transaction.category_id)
    )
    spent_by_category = {
        category_id: total for category_id, total in (await session.execute(spent_stmt)).all()
    }

    budget_stmt = (
        select(Category.name, Budget.category_id, Budget.amount_limit)
        .join(Category, Budget.category_id == Category.id)
        .where(
            Budget.user_id == user_id,
            Budget.month == start.month,
            Budget.year == start.year,
        )
        .order_by(Category.name)
    )
    envelopes = [
        {
            "name": name,
            "remaining": amount_limit - spent_by_category.get(category_id, Decimal("0")),
        }
        for name, category_id, amount_limit in (await session.execute(budget_stmt)).all()
    ]

    return {
        "income": income,
        "expense": expense,
        "free": income - expense,
        "envelopes": envelopes,
    }
