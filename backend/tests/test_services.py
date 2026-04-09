import pytest
import asyncio
import uuid
from decimal import Decimal
from unittest.mock import MagicMock
from datetime import datetime

from src.schemas.transaction import TransactionCreate
from src.services.transaction_service import TransactionService
from src.services.dashboard_service import DashboardService
from src.domain.models import Category, Transaction, BudgetPlan


@pytest.mark.asyncio
async def test_transaction_idempotency(mock_db_session, mock_redis):
    """
    Критический тест: Напиши тест на идемпотентность. Симулируй два параллельных запроса
    с одинаковым idempotency_key и проверь, что баланс пользователя не задвоился.
    """
    user_id = 1
    idempotency_key = str(uuid.uuid4())
    tx_data = TransactionCreate(
        category_id=2, amount=Decimal("500.00"), executed_at=datetime.utcnow()
    )

    # 1. Simulate behavior: first call acquires lock, second call fails to acquire lock
    mock_redis.set.side_effect = [True, False]

    # Service setup
    service = TransactionService(mock_db_session, mock_redis)

    # Mock category retrieval logic
    cat_mock = Category(id=2, user_id=1, type="expense")
    # AsyncMock for session.execute(...).scalar_one_or_none()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = cat_mock
    mock_db_session.execute.return_value = mock_result

    # 2. Simulate concurrent execution
    # In real app, the HTTP layer would handle the Exception if locked.
    # We will wrap it to catch the exception.
    results = []

    async def run_request():
        try:
            res = await service.create_transaction(user_id, idempotency_key, tx_data)
            results.append(("SUCCESS", res))
        except Exception as e:
            results.append(("ERROR", str(e)))

    await asyncio.gather(run_request(), run_request())

    # 3. Validation: Only one success, one error
    successes = [r for r in results if r[0] == "SUCCESS"]
    errors = [r for r in results if r[0] == "ERROR"]

    assert len(successes) == 1, "Only one transaction should be successfully processed."
    assert (
        len(errors) == 1
    ), "The concurrent transaction must fail due to idempotency lock."
    assert (
        "Idempotency key" in errors[0][1] or "locked" in errors[0][1].lower()
    ), "Must fail with specific lock error."

    # Validate that DB session add/commit was only called once
    assert mock_db_session.add.call_count == 1
    assert mock_db_session.commit.call_count == 1


@pytest.mark.asyncio
async def test_dashboard_aggregation_algorithm(mock_db_session):
    """
    Критический тест: Проверь алгоритм O(N) агрегации DashboardResponse.
    Собирает массив из 31 дня и правильно считает дельту.
    """
    user_id = 1
    year, month = 2025, 7

    # Mock Data:
    # Category 1: Mortgage (Planned: 1000, Actual: 1000 on day 15) -> Delta: 0
    # Category 2: Food (Planned: 500, Actual: 200 on day 2, 100 on day 2) -> Delta: +200

    cat1 = MagicMock(id=1, name="Mortgage")
    cat1.id = 1
    cat1.name = "Mortgage"
    cat2 = MagicMock(id=2, name="Food")
    cat2.id = 2
    cat2.name = "Food"

    # Mock budget execution results
    mock_db_session.execute.side_effect = [
        # Query 1: Categories
        MagicMock(scalars=lambda: MagicMock(all=lambda: [cat1, cat2])),
        # Query 2: BudgetPlans
        MagicMock(
            scalars=lambda: MagicMock(
                all=lambda: [
                    BudgetPlan(category_id=1, planned_amount=Decimal("1000.00")),
                    BudgetPlan(category_id=2, planned_amount=Decimal("500.00")),
                ]
            )
        ),
        # Query 3: Transactions
        MagicMock(
            scalars=lambda: MagicMock(
                all=lambda: [
                    Transaction(
                        category_id=1,
                        amount=Decimal("1000.00"),
                        executed_at=datetime(2025, 7, 15, 10, 0),
                    ),
                    Transaction(
                        category_id=2,
                        amount=Decimal("200.00"),
                        executed_at=datetime(2025, 7, 2, 10, 0),
                    ),
                    Transaction(
                        category_id=2,
                        amount=Decimal("100.00"),
                        executed_at=datetime(2025, 7, 2, 15, 0),
                    ),
                ]
            )
        ),
    ]

    service = DashboardService(mock_db_session)
    response = await service.get_dashboard_matrix(user_id, year, month)

    # Validation
    assert response.year == 2025
    assert response.month == 7
    assert len(response.categories) == 2

    # Check Category 1 (Mortgage)
    mortgage_row = next(r for r in response.categories if r.category_id == 1)
    assert mortgage_row.planned == "1000.00"
    assert mortgage_row.fact == "1000.00"
    assert mortgage_row.delta == "0.00"
    assert mortgage_row.days[14].amount == "1000.00"  # 0-indexed month day 15
    assert mortgage_row.days[0].amount == "0.00"

    # Check Category 2 (Food)
    food_row = next(r for r in response.categories if r.category_id == 2)
    assert food_row.planned == "500.00"
    assert food_row.fact == "300.00"
    assert food_row.delta == "200.00"
    assert food_row.days[1].amount == "300.00"  # 0-indexed month day 2
    assert sum(Decimal(d.amount) for d in food_row.days) == Decimal("300.00")
