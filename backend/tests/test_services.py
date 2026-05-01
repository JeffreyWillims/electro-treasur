"""
Unit tests for transaction_service (functional API) and dashboard aggregation.

Architecture note (post-refactor):
  • TransactionService class → standalone async functions in transaction_service.
  • BudgetPlan model → Budget model (field: amount_limit, not planned_amount).
  • DashboardService class → standalone async function get_monthly_dashboard().
  • DashboardResponse shape: .rows (not .categories), .period_income,
    .period_expense, .total_balance_all_time.
  • get_monthly_dashboard executes 4 SQL queries in order:
      Step 0 — all-time balance (income/expense group-by type)
      Step 1 — transactions grouped by (category_id, type, exec_date)
      Step 2 — budgets SUM(amount_limit) group-by category_id
      Step 3 — category names/types
"""

import asyncio
import uuid
from datetime import date, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from src.domain.models import Category
from src.schemas.transaction import TransactionCreate
from src.services.dashboard_service import get_monthly_dashboard
from src.services.transaction_service import create_transaction

# ══════════════════════════════════════════════════════════════════════════════
# Test 1 — TransactionService: Idempotency Lock (unchanged logic)
# ══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_transaction_idempotency(mock_db_session, mock_redis):
    """
    Critical test: verify idempotency guard on create_transaction (functional API).

    Scenario:
      • Request 1 — cache MISS → DB INSERT → cache SET → returns TransactionResponse.
      • Request 2 — same key → cache HIT → returns early (no DB write).

    Validates that two concurrent calls with the same idempotency_key result in
    exactly one DB add/commit cycle (O(1) dedup via Redis).
    """
    import json

    from unittest.mock import AsyncMock, patch

    user_id = 1
    idempotency_key = str(uuid.uuid4())
    tx_data = TransactionCreate(
        category_id=2, amount=Decimal("500.00"), executed_at=datetime.utcnow()
    )

    # Minimal cached JSON that TransactionResponse.model_validate_json can parse
    cached_json = json.dumps(
        {
            "id": 99,
            "user_id": user_id,
            "category_id": 2,
            "amount": "500.00",
            "currency": "RUB",
            "is_recurring": False,
            "entry_type": "expense",
            "executed_at": datetime.utcnow().isoformat(),
            "idempotency_key": idempotency_key,
            "category_name": None,
            "comment": None,
        }
    )

    # First call: GET → None (miss); Second call: GET → cached JSON (hit)
    mock_redis.get = AsyncMock(side_effect=[None, cached_json.encode()])
    mock_redis.set = AsyncMock(return_value=True)

    # DB mock: used only by request 1
    cat_mock = Category(id=2, user_id=1, type="expense")
    db_result = MagicMock()
    db_result.scalar_one_or_none.return_value = cat_mock

    tx_mock = MagicMock()
    tx_mock.id = 99
    tx_mock.user_id = user_id
    tx_mock.category_id = 2
    tx_mock.amount = Decimal("500.00")
    tx_mock.currency = "RUB"
    tx_mock.is_recurring = False
    tx_mock.entry_type = "expense"
    tx_mock.executed_at = datetime.utcnow()
    tx_mock.idempotency_key = idempotency_key
    tx_mock.category_name = None
    tx_mock.comment = None

    mock_db_session.execute.return_value = db_result
    mock_db_session.refresh = AsyncMock()

    # Patch model_validate to avoid full ORM hydration in unit test
    from src.schemas.transaction import TransactionResponse

    with patch.object(
        TransactionResponse, "model_validate", return_value=TransactionResponse(**{
            "id": 99, "user_id": user_id, "category_id": 2,
            "amount": Decimal("500.00"), "currency": "RUB", "is_recurring": False,
            "entry_type": "expense", "executed_at": datetime.utcnow(),
            "idempotency_key": idempotency_key, "category_name": None, "comment": None,
        })
    ):
        # Request 1: cache miss → DB write
        result1 = await create_transaction(
            mock_db_session, mock_redis, user_id, tx_data, idempotency_key
        )
        # Request 2: cache hit → no DB write
        result2 = await create_transaction(
            mock_db_session, mock_redis, user_id, tx_data, idempotency_key
        )

    # Idempotency guarantee: DB touched exactly once
    assert mock_db_session.add.call_count == 1, "DB insert must happen exactly once."
    assert mock_db_session.commit.call_count == 1, "Commit must happen exactly once."
    assert mock_redis.set.call_count == 1, "Cache set must happen exactly once."
    assert mock_redis.get.call_count == 2, "Both requests must check the cache."


# ══════════════════════════════════════════════════════════════════════════════
# Test 2 — get_monthly_dashboard: O(N) Aggregation Algorithm
# ══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_dashboard_aggregation_algorithm(mock_db_session):
    """
    Verify the O(N) aggregation function get_monthly_dashboard().

    Scenario:
      • Category 1 — expense "Mortgage": limit 1 000, spent 1 000 on day 15 → delta 0
      • Category 2 — expense "Food":     limit   500, spent 300 on day 2  → delta +200

    Date range: 2025-07-01 → 2025-07-31  (day_count = 31)
    """
    user_id = 1
    start = date(2025, 7, 1)
    end = date(2025, 7, 31)

    # ── Step 0 mock: all-time balance (income - expense grouping) ─────────
    step0_result = MagicMock()
    step0_result.all.return_value = [
        ("income", Decimal("5000.00")),
        ("expense", Decimal("1300.00")),  # 1000 + 300
    ]

    # ── Step 1 mock: transactions grouped by (cat_id, type, exec_date) ───
    step1_result = MagicMock()
    step1_result.all.return_value = [
        # (category_id, cat_type, exec_date,          total)
        (1, "expense", date(2025, 7, 15), Decimal("1000.00")),
        (
            2,
            "expense",
            date(2025, 7, 2),
            Decimal("300.00"),
        ),  # 200 + 100 pre-aggregated by SQL
    ]

    # ── Step 2 mock: budget SUM per category (new GROUP BY approach) ──────
    step2_result = MagicMock()
    # Simulate SQLAlchemy Row objects with .category_id and .total_limit attrs
    bp1 = MagicMock()
    bp1.category_id = 1
    bp1.total_limit = Decimal("1000.00")
    bp2 = MagicMock()
    bp2.category_id = 2
    bp2.total_limit = Decimal("500.00")
    step2_result.all.return_value = [bp1, bp2]

    # ── Step 3 mock: category info ────────────────────────────────────────
    step3_result = MagicMock()
    cat_row1 = MagicMock()
    cat_row1.id = 1
    cat_row1.name = "Mortgage"
    cat_row1.type = "expense"
    cat_row2 = MagicMock()
    cat_row2.id = 2
    cat_row2.name = "Food"
    cat_row2.type = "expense"
    step3_result.all.return_value = [cat_row1, cat_row2]

    # Wire mocks in query-execution order (Steps 0 → 1 → 2 → 3)
    mock_db_session.execute.side_effect = [
        step0_result,
        step1_result,
        step2_result,
        step3_result,
    ]

    # ── Execute ───────────────────────────────────────────────────────────
    response = await get_monthly_dashboard(mock_db_session, user_id, start, end)

    # ── Top-level assertions ──────────────────────────────────────────────
    assert response.start_date == start
    assert response.end_date == end

    # total_balance_all_time = income - expense = 5000 - 1300 = 3700
    assert response.total_balance_all_time == Decimal("3700.00")

    # period_income / period_expense come from Step 4 (in-range transactions)
    assert response.period_income == Decimal("0.00")  # no income tx in range
    assert response.period_expense == Decimal("1300.00")  # 1000 + 300

    assert len(response.rows) == 2

    # ── Category 1: Mortgage ──────────────────────────────────────────────
    mortgage_row = next(r for r in response.rows if r.category_id == 1)
    assert mortgage_row.planned == Decimal("1000.00")
    assert mortgage_row.fact == Decimal("1000.00")
    assert mortgage_row.delta == Decimal("0.00")  # expense: planned - fact
    assert len(mortgage_row.days) == 31  # full July vector

    # Day 15 → index 14
    assert mortgage_row.days[14].amount == Decimal("1000.00")
    assert mortgage_row.days[0].amount == Decimal("0.00")

    # ── Category 2: Food ─────────────────────────────────────────────────
    food_row = next(r for r in response.rows if r.category_id == 2)
    assert food_row.planned == Decimal("500.00")
    assert food_row.fact == Decimal("300.00")
    assert food_row.delta == Decimal("200.00")  # 500 - 300

    # Day 2 → index 1
    assert food_row.days[1].amount == Decimal("300.00")
    assert sum(Decimal(str(d.amount)) for d in food_row.days) == Decimal("300.00")


# ══════════════════════════════════════════════════════════════════════════════
# Test 3 — get_monthly_dashboard: Multi-Month Budget Aggregation (61-day range)
# ══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_dashboard_multi_month_budget_sum(mock_db_session):
    """
    Regression test for the 61-day anomaly fix.

    When user selects Apr 01 – May 31, Step 2 must SUM budget limits across
    both months (not overwrite). A category with 10 000 in April and 15 000
    in May should appear with planned = 25 000.
    """
    user_id = 1
    start = date(2025, 4, 1)
    end = date(2025, 5, 31)  # day_count = 61

    # Step 0 — all-time balance
    step0 = MagicMock()
    step0.all.return_value = [("income", Decimal("0.00")), ("expense", Decimal("0.00"))]

    # Step 1 — no transactions in range
    step1 = MagicMock()
    step1.all.return_value = []

    # Step 2 — SUM(10 000 + 15 000) = 25 000 for cat_id=1
    step2 = MagicMock()
    bp = MagicMock()
    bp.category_id = 1
    bp.total_limit = Decimal("25000.00")  # SQL already summed both months
    step2.all.return_value = [bp]

    # Step 3 — category info
    step3 = MagicMock()
    cat = MagicMock()
    cat.id = 1
    cat.name = "Rent"
    cat.type = "expense"
    step3.all.return_value = [cat]

    mock_db_session.execute.side_effect = [step0, step1, step2, step3]

    response = await get_monthly_dashboard(mock_db_session, user_id, start, end)

    rent_row = response.rows[0]
    assert len(rent_row.days) == 61  # 61-day vector, not 31
    assert rent_row.planned == Decimal("25000.00")  # summed, not overwritten
    assert rent_row.fact == Decimal("0.00")
    assert rent_row.delta == Decimal("25000.00")
