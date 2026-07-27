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

from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, Transaction
from src.schemas.dashboard import CategoryRowSchema, DashboardResponse, DayCellSchema


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

    # ── Шаг 0: общий баланс за всё время ───────
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

    # ── Шаг 1: агрегированные транзакции, сгруппированные по дате ─────────
    # Sargable-фильтр по сырому executed_at: диапазон [start; end+1) в UTC
    # использует индекс (user_id, executed_at). Раньше здесь стоял
    # func.date(executed_at) в WHERE — функция над колонкой блокировала индекс
    # и заставляла сканировать всю историю транзакций юзера на каждый дашборд.
    # Границы в UTC совпадают с семантикой func.date() в GROUP BY; редкие
    # граничные строки из-за tz-дрейфа строго отсекаются day-index-гардом в Step 4.
    range_start = datetime.combine(start_date, time.min, tzinfo=UTC)
    range_end = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=UTC)
    # День бакетим в ЯВНОМ UTC. executed_at — timestamptz; голый func.date(executed_at)
    # выполняется в TimeZone сервера БД, и если Postgres развёрнут не в UTC, строки
    # у границы суток попадали в чужой день и расходились с UTC-границами WHERE.
    # timezone('UTC', ts) приводит к UTC-стенке независимо от настройки сервера.
    exec_date_utc = func.date(func.timezone("UTC", Transaction.executed_at))
    stmt_tx = (
        select(
            Transaction.category_id,
            Category.type,
            exec_date_utc.label("exec_date"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.executed_at >= range_start,
            Transaction.executed_at < range_end,
        )
        .group_by(Transaction.category_id, Category.type, exec_date_utc)
    )
    tx_result = await session.execute(stmt_tx)
    tx_rows = tx_result.all()  # list[(category_id, type, exec_date, total)]

    # ── Шаг 2: безопасно получаем и агрегируем бюджеты ──────────────────
    # GROUP BY category_id + SUM(amount_limit), чтобы многомесячные диапазоны
    # (напр. 1 апреля – 31 мая) корректно суммировали лимиты, а не
    # перезаписывали значение более раннего месяца значением более позднего.
    stmt_bp = (
        select(
            Budget.category_id,
            func.sum(Budget.amount_limit).label("total_limit"),
        )
        .where(
            Budget.user_id == user_id,
            or_(
                (Budget.month == start_date.month) & (Budget.year == start_date.year),
                (Budget.month == end_date.month) & (Budget.year == end_date.year),
            ),
        )
        .group_by(Budget.category_id)
    )
    bp_result = await session.execute(stmt_bp)
    plans: dict[int, Decimal] = {row.category_id: row.total_limit for row in bp_result.all()}

    # ── Шаг 3: получаем названия категорий ─────────
    stmt_cat = select(Category.id, Category.name, Category.type, Category.icon).where(
        Category.user_id == user_id
    )
    cat_result = await session.execute(stmt_cat)
    cat_info: dict[int, dict[str, Any]] = {
        row.id: {"name": row.name, "type": row.type, "icon": row.icon} for row in cat_result.all()
    }

    # ── Шаг 4: агрегация в матрицу дней за один проход O(N) ─────────────
    #   matrix[category_id][day_index] = Decimal
    #
    #   Защита от часового пояса (подстраховка): exec_date теперь считается в
    #   явном UTC (func.timezone('UTC', ...)) и совпадает с UTC-границами WHERE,
    #   поэтому delta_days вне [0; day_count) в норме не встречается. Guard оставлен
    #   на случай будущих правок фильтра/границ: строку с delta_days = -1 или
    #   >= day_count молча пропускаем (`continue`), чтобы не портить корзину 0/N-1
    #   (в total_balance_all_time из Шага 0 она всё равно учтена).
    matrix: dict[int, list[Decimal]] = {}
    fact_totals: dict[int, Decimal] = {}
    period_income = Decimal("0.00")
    period_expense = Decimal("0.00")

    for cat_id, cat_type, raw_exec_date, total in tx_rows:
        cat_id = int(cat_id)

        # Железобетонный парсинг: PostgreSQL может вернуть str, datetime или date.
        # [:10] отрезает время, если PostgreSQL вернул ISO-строку с timestamp.
        if isinstance(raw_exec_date, str):
            exec_date = date.fromisoformat(raw_exec_date[:10])
        elif isinstance(raw_exec_date, datetime):
            exec_date = raw_exec_date.date()
        else:
            exec_date = raw_exec_date  # Уже объект date

        # Расчёт индекса дня со строгой проверкой границ.
        delta_days = (exec_date - start_date).days

        # Дрейф часового пояса → delta_days может быть -1 или >= day_count.
        # Молча отбрасываем: строка всё равно учтена в total_balance_all_time
        # (Шаг 0), но не должна портить вектор дней фиксированной длины.
        if delta_days < 0 or delta_days >= day_count:
            continue

        if cat_id not in matrix:
            matrix[cat_id] = [Decimal("0.00")] * day_count
            fact_totals[cat_id] = Decimal("0.00")

        matrix[cat_id][delta_days] += total
        fact_totals[cat_id] += total

        if cat_type == "income":
            period_income += total
        elif cat_type == "expense":
            period_expense += total

    # ── Шаг 5: собираем строки ответа ───────────
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
                category_icon=info.get("icon"),
                type=info["type"],
                planned=planned,
                fact=fact,
                delta=(planned - fact if info["type"] == "expense" else fact - planned),
                days=[DayCellSchema(day=i + 1, amount=days_data[i]) for i in range(day_count)],
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
