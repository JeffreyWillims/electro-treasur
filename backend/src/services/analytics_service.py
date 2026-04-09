"""Service for analytics and simulation."""

from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.domain.models import Category, Transaction, Budget, CategoryType
from src.schemas.analytics import (
    AnalyticsProfileResponse,
    CategoryAvg,
    SimulateRequest,
    SimulateResponse,
    SimulationDataPoint,
)


async def get_analytics_profile(
    session: AsyncSession, user_id: int
) -> AnalyticsProfileResponse:
    today = date.today()
    three_months_ago = today - timedelta(days=90)

    # Get all expense categories
    cat_stmt = select(Category).where(
        Category.user_id == user_id, Category.type == CategoryType.expense
    )
    categories = (await session.scalars(cat_stmt)).all()

    # Get sum of transactions per category for last 3 months
    trx_stmt = (
        select(
            Transaction.category_id, func.sum(Transaction.amount).label("total_amount")
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.executed_at >= three_months_ago,
            (
                Transaction.category_id.in_([c.id for c in categories])
                if categories
                else False
            ),
        )
        .group_by(Transaction.category_id)
    )

    trx_results = (await session.execute(trx_stmt)).all()
    trx_map = {
        row.category_id: Decimal(row.total_amount) / Decimal(3) for row in trx_results
    }

    # Get budgets to fallback
    budget_stmt = select(Budget).where(
        Budget.user_id == user_id,
        Budget.month == today.month,
        Budget.year == today.year,
    )
    budgets = (await session.scalars(budget_stmt)).all()
    budget_map = {b.category_id: b.amount_limit for b in budgets}

    cat_avgs = []
    for cat in categories:
        avg_amt = trx_map.get(cat.id)
        if avg_amt is None or avg_amt == 0:
            avg_amt = budget_map.get(cat.id, Decimal("0"))
        cat_avgs.append(
            CategoryAvg(
                category_id=cat.id, name=cat.name, avg_amount=Decimal(round(avg_amt, 2))
            )
        )

    # Get average income
    inc_stmt = (
        select(func.sum(Transaction.amount))
        .join(Category)
        .where(
            Transaction.user_id == user_id,
            Transaction.executed_at >= three_months_ago,
            Category.type == CategoryType.income,
        )
    )
    total_inc = (await session.execute(inc_stmt)).scalar() or Decimal("0")
    avg_inc = Decimal(total_inc) / Decimal(3)

    return AnalyticsProfileResponse(
        categories=cat_avgs, avg_income=Decimal(round(avg_inc, 2))
    )


async def simulate_savings(request: SimulateRequest) -> SimulateResponse:
    base_savings = request.initial_savings
    optimized_savings = request.initial_savings

    base_expense_total = sum(
        (c.avg_amount for c in request.base_expenses), Decimal("0")
    )
    base_monthly_addition = max(request.avg_income - base_expense_total, Decimal("0"))

    adj_map = {a.category_id: a.new_amount for a in request.adjustments}
    optimized_expense_total = sum(
        (adj_map.get(c.category_id, c.avg_amount) for c in request.base_expenses),
        Decimal("0"),
    )
    # Habit savings are added to the monthly surplus
    optimized_monthly_addition = max(
        request.avg_income - optimized_expense_total + request.habit_savings,
        Decimal("0"),
    )

    bank_rate_monthly = (request.bank_rate / Decimal("100")) / Decimal("12")

    chart_data = []
    current_date = date.today()

    base_date = None
    optimized_date = None

    for i in range(120):  # max 10 years simulation
        current_date_str = current_date.strftime("%Y-%m")
        chart_data.append(
            SimulationDataPoint(
                month=current_date_str,
                base_savings=Decimal(round(base_savings, 2)),
                optimized_savings=Decimal(round(optimized_savings, 2)),
            )
        )

        if base_date is None and base_savings >= request.target_amount:
            base_date = current_date
        if optimized_date is None and optimized_savings >= request.target_amount:
            optimized_date = current_date

        if base_date and optimized_date and i > 12:
            pass  # We could break early, but let's give at least a year of chart

        if base_date and optimized_date and i > 24:
            break

        base_interest = base_savings * bank_rate_monthly
        base_savings += base_interest + base_monthly_addition

        optimized_interest = optimized_savings * bank_rate_monthly
        optimized_savings += optimized_interest + optimized_monthly_addition

        current_date += timedelta(days=30)

    days_saved = 0
    if base_date and optimized_date:
        days_saved = (base_date - optimized_date).days
    elif optimized_date and not base_date:
        # If base path never reaches target but optimized does, we cap at simulation length
        days_saved = (date.today() + timedelta(days=3650) - optimized_date).days

    return SimulateResponse(
        base_target_date=base_date,
        optimized_target_date=optimized_date,
        days_saved=max(0, days_saved),
        chart_data=chart_data,
    )
