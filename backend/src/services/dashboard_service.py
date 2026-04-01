"""
Dashboard Service — O(N) Monthly Aggregation.

Algorithm:
  1. Fetch all transactions for (user_id, month) in a SINGLE query  → O(N) rows.
  2. Fetch all budget plans for (user_id, month) in one query         → O(K) rows.
  3. Single-pass aggregation: iterate over transactions, bucket into
     dict[category_id][day_number] accumulator                        → O(N).
  4. Merge with plans, compute delta, emit 31-day vectors             → O(K).
  Total: O(N + K) ≈ O(N) for large transaction sets.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, Transaction
from src.schemas.dashboard import (
    CategoryRowSchema,
    DashboardResponse,
    DayCellSchema,
)


async def get_monthly_dashboard(
    session: AsyncSession,
    user_id: int,
    year: int,
    month: int,
) -> DashboardResponse:
    """
    Build the full budget matrix for a given user + month.

    Returns DashboardResponse with one row per category, each containing
    a 31-element day vector.

    Time:  O(N + K)  where N=transactions, K=categories with plans.
    Space: O(K * 31) for the day matrix.
    """
    first_day = date(year, month, 1)

    # ── Step 1: Fetch aggregated transactions grouped by (category_id, day) ─
    stmt_tx = (
        select(
            Transaction.category_id,
            extract("day", Transaction.executed_at).label("day_num"),
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.user_id == user_id,
            extract("year", Transaction.executed_at) == year,
            extract("month", Transaction.executed_at) == month,
        )
        .group_by(Transaction.category_id, extract("day", Transaction.executed_at))
    )
    tx_result = await session.execute(stmt_tx)
    tx_rows = tx_result.all()  # list[(category_id, day_num, total)]

    # ── Step 2: Fetch budgets for the month ─────────────────────────
    stmt_bp = (
        select(Budget.category_id, Budget.amount_limit)
        .where(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
    )
    bp_result = await session.execute(stmt_bp)
    plans: dict[int, Decimal] = {row.category_id: row.amount_limit for row in bp_result.all()}

    # ── Step 3: Fetch category names ─────────────────────────────────────
    stmt_cat = select(Category.id, Category.name).where(Category.user_id == user_id)
    cat_result = await session.execute(stmt_cat)
    cat_names: dict[int, str] = {row.id: row.name for row in cat_result.all()}

    # ── Step 4: O(N) single-pass aggregation into day matrix ─────────────
    #   matrix[category_id][day_index] = Decimal
    matrix: dict[int, list[Decimal]] = {}
    fact_totals: dict[int, Decimal] = {}

    for cat_id, day_num, total in tx_rows:
        cat_id = int(cat_id)
        day_index = int(day_num) - 1  # 0-based
        if cat_id not in matrix:
            matrix[cat_id] = [Decimal("0.00")] * 31
            fact_totals[cat_id] = Decimal("0.00")
        matrix[cat_id][day_index] += total  # type: ignore[operator]
        fact_totals[cat_id] += total  # type: ignore[operator]

    # ── Step 5: Build response rows — O(K) ───────────────────────────────
    all_cat_ids = set(plans.keys()) | set(matrix.keys())
    rows: list[CategoryRowSchema] = []

    for cat_id in sorted(all_cat_ids):
        planned = plans.get(cat_id, Decimal("0.00"))
        fact = fact_totals.get(cat_id, Decimal("0.00"))
        days_data = matrix.get(cat_id, [Decimal("0.00")] * 31)

        rows.append(
            CategoryRowSchema(
                category_id=cat_id,
                category_name=cat_names.get(cat_id, f"Category #{cat_id}"),
                planned=planned,
                fact=fact,
                delta=planned - fact,
                days=[DayCellSchema(day=i + 1, amount=days_data[i]) for i in range(31)],
            )
        )

    return DashboardResponse(month=month, year=year, rows=rows)
