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

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.domain.models import Budget, Category, Transaction
from src.schemas.dashboard import (CategoryRowSchema, DashboardResponse,
                                   DayCellSchema)


async def get_monthly_dashboard(
    session: AsyncSession,
    user_id: int,
    start_date: date,
    end_date: date,
) -> DashboardResponse:
    """
    Build the full budget matrix for a given user + date range.

    Returns DashboardResponse with one row per category, each containing
    a variable-length day vector.

    Time:  O(N + K)  where N=transactions, K=categories with plans.
    """
    day_count = (end_date - start_date).days + 1
    if day_count <= 0:
        day_count = 1

    # ── Step 0: Total Balance All Time ────────────────────────────────
    stmt_all = (
        select(Category.type, func.sum(Transaction.amount))
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.user_id == user_id)
        .group_by(Category.type)
    )
    all_res = await session.execute(stmt_all)
    all_totals = {r[0]: (r[1] or Decimal("0.00")) for r in all_res.all()}
    total_balance_all_time = all_totals.get("income", Decimal("0.00")) - all_totals.get(
        "expense", Decimal("0.00")
    )

    # ── Step 1: Fetch aggregated transactions grouped by date ─────────
    stmt_tx = (
        select(
            Transaction.category_id,
            Category.type,
            func.date(Transaction.executed_at).label("exec_date"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            func.date(Transaction.executed_at) >= start_date,
            func.date(Transaction.executed_at) <= end_date,
        )
        .group_by(
            Transaction.category_id, Category.type, func.date(Transaction.executed_at)
        )
    )
    tx_result = await session.execute(stmt_tx)
    tx_rows = tx_result.all()  # list[(category_id, type, exec_date, total)]

    # ── Step 2: Fetch budgets ─────────────────────────
    # For budgets, we'll try to match the month of the start_date as a proxy or just aggregate any budget that touches the range.
    # To keep it simple, we filter by start_date's month/year
    stmt_bp = select(Budget.category_id, Budget.amount_limit).where(
        Budget.user_id == user_id,
        Budget.month == start_date.month,
        Budget.year == start_date.year,
    )
    bp_result = await session.execute(stmt_bp)
    plans: dict[int, Decimal] = {
        row.category_id: row.amount_limit for row in bp_result.all()
    }

    # ── Step 3: Fetch category names ─────────────────────────────────────
    stmt_cat = select(Category.id, Category.name, Category.type).where(
        Category.user_id == user_id
    )
    cat_result = await session.execute(stmt_cat)
    cat_info: dict[int, dict] = {
        row.id: {"name": row.name, "type": row.type} for row in cat_result.all()
    }

    # ── Step 4: O(N) single-pass aggregation into day matrix ─────────────
    #   matrix[category_id][day_index] = Decimal
    matrix: dict[int, list[Decimal]] = {}
    fact_totals: dict[int, Decimal] = {}
    period_income = Decimal("0.00")
    period_expense = Decimal("0.00")

    for cat_id, cat_type, exec_date, total in tx_rows:
        cat_id = int(cat_id)

        # Calculate day index based on start_date
        delta_days = (exec_date - start_date).days
        day_index = max(0, min(delta_days, day_count - 1))

        if cat_id not in matrix:
            matrix[cat_id] = [Decimal("0.00")] * day_count
            fact_totals[cat_id] = Decimal("0.00")

        matrix[cat_id][day_index] += total
        fact_totals[cat_id] += total

        if cat_type == "income":
            period_income += total
        elif cat_type == "expense":
            period_expense += total

    # ── Step 5: Build response rows — O(K) ───────────────────────────────
    all_cat_ids = set(plans.keys()) | set(matrix.keys())
    rows: list[CategoryRowSchema] = []

    for cat_id in sorted(all_cat_ids):
        planned = plans.get(cat_id, Decimal("0.00"))
        fact = fact_totals.get(cat_id, Decimal("0.00"))
        days_data = matrix.get(cat_id, [Decimal("0.00")] * day_count)
        info = cat_info.get(cat_id, {"name": f"Category #{cat_id}", "type": "expense"})

        rows.append(
            CategoryRowSchema(
                category_id=cat_id,
                category_name=info["name"],
                type=info["type"],
                planned=planned,
                fact=fact,
                delta=planned - fact if info["type"] == "expense" else fact - planned,
                days=[
                    DayCellSchema(day=i + 1, amount=days_data[i])
                    for i in range(day_count)
                ],
            )
        )

    return DashboardResponse(
        start_date=start_date,
        end_date=end_date,
        total_balance_all_time=total_balance_all_time,
        period_income=period_income,
        period_expense=period_expense,
        rows=rows,
    )
