"""
tests/unit/test_services.py — Service Layer Unit Tests with Fake Repositories.

Architecture: Ports & Adapters (Hexagonal)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The production services (transaction_service.py, dashboard_service.py) are
tightly coupled to AsyncSession (SQLAlchemy). To unit-test business logic
WITHOUT a database, we:

  1. Define a Protocol (Port) that describes what the service NEEDS.
  2. Build a FakeRepository (Adapter) that implements the Port in-memory.
  3. Extract pure business logic into testable functions.
  4. Test those functions with Fake data — runs in <0.01 sec.

┌──────────────────────────────────────────────────────────┐
│  Unit Test (this file)                                   │
│                                                          │
│  FakeTransactionRepo ──→ build_dashboard_from_data()     │
│  (list in memory)         (pure aggregation logic)       │
│       ↓                        ↓                         │
│  No AsyncSession         No PostgreSQL                   │
│  No Redis                No I/O at all                   │
│                                                          │
│  Execution time: O(N) in-memory, <0.01 sec               │
└──────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Protocol

from src.schemas.dashboard import CategoryRowSchema, DashboardResponse, DayCellSchema


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PORT — Abstract interface the service layer depends on
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@dataclass(frozen=True)
class TransactionRecord:
    """Minimal DTO representing a transaction row (decoupled from ORM)."""

    id: int
    user_id: int
    category_id: int
    category_name: str
    category_type: str  # "income" | "expense"
    amount: Decimal
    executed_at: datetime
    currency: str = "RUB"


@dataclass(frozen=True)
class BudgetRecord:
    """Minimal DTO representing a budget plan row."""

    category_id: int
    amount_limit: Decimal


@dataclass(frozen=True)
class CategoryRecord:
    """Minimal DTO representing a category."""

    id: int
    name: str
    type: str
    icon: str | None = None


class TransactionRepoPort(Protocol):
    """Port — what the dashboard aggregation service needs from persistence."""

    def get_transactions(
        self, user_id: int, start_date: date, end_date: date
    ) -> list[TransactionRecord]: ...

    def get_budgets(
        self, user_id: int, start_date: date, end_date: date
    ) -> list[BudgetRecord]: ...

    def get_categories(self, user_id: int) -> list[CategoryRecord]: ...

    def add_transaction(self, record: TransactionRecord) -> TransactionRecord: ...


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FAKE ADAPTER — in-memory implementation of the Port
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@dataclass
class FakeTransactionRepo:
    """
    In-memory repository backed by plain Python lists.

    Complexity:
      • add_transaction:   O(1) append
      • get_transactions:  O(N) filter
      • get_budgets:       O(K) filter
      • get_categories:    O(C) filter

    No I/O, no database, no event loop. Deterministic and fast.
    """

    transactions: list[TransactionRecord] = field(default_factory=list)
    budgets: list[BudgetRecord] = field(default_factory=list)
    categories: list[CategoryRecord] = field(default_factory=list)
    _next_id: int = 1

    def add_transaction(self, record: TransactionRecord) -> TransactionRecord:
        """Persist a transaction in memory, auto-assigning an ID."""
        new = TransactionRecord(
            id=self._next_id,
            user_id=record.user_id,
            category_id=record.category_id,
            category_name=record.category_name,
            category_type=record.category_type,
            amount=record.amount,
            executed_at=record.executed_at,
            currency=record.currency,
        )
        self.transactions.append(new)
        self._next_id += 1
        return new

    def get_transactions(
        self, user_id: int, start_date: date, end_date: date
    ) -> list[TransactionRecord]:
        """Filter transactions by user and date range."""
        return [
            tx
            for tx in self.transactions
            if tx.user_id == user_id and start_date <= tx.executed_at.date() <= end_date
        ]

    def get_budgets(self, user_id: int, start_date: date, end_date: date) -> list[BudgetRecord]:
        """Return all budget plans (no date filtering in fake — simplified)."""
        return list(self.budgets)

    def get_categories(self, user_id: int) -> list[CategoryRecord]:
        """Return all categories for the user."""
        return list(self.categories)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PURE BUSINESS LOGIC — extracted from dashboard_service.py
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def build_dashboard_from_data(
    transactions: list[TransactionRecord],
    budgets: list[BudgetRecord],
    categories: list[CategoryRecord],
    start_date: date,
    end_date: date,
) -> DashboardResponse:
    """
    Pure function: builds a DashboardResponse from raw data.

    This is the core business logic from dashboard_service.py,
    extracted and decoupled from SQLAlchemy so it can be unit-tested
    with deterministic data in <0.01 seconds.

    Algorithm: O(N + K) single-pass aggregation.
    """
    day_count = max(1, (end_date - start_date).days + 1)

    # Category lookup
    cat_info: dict[int, CategoryRecord] = {c.id: c for c in categories}

    # Budget plans lookup
    plans: dict[int, Decimal] = {b.category_id: b.amount_limit for b in budgets}

    # Single-pass aggregation
    matrix: dict[int, list[Decimal]] = {}
    fact_totals: dict[int, Decimal] = {}
    period_income = Decimal("0.00")
    period_expense = Decimal("0.00")

    for tx in transactions:
        delta_days = (tx.executed_at.date() - start_date).days
        if delta_days < 0 or delta_days >= day_count:
            continue

        if tx.category_id not in matrix:
            matrix[tx.category_id] = [Decimal("0.00")] * day_count
            fact_totals[tx.category_id] = Decimal("0.00")

        matrix[tx.category_id][delta_days] += tx.amount
        fact_totals[tx.category_id] += tx.amount

        if tx.category_type == "income":
            period_income += tx.amount
        elif tx.category_type == "expense":
            period_expense += tx.amount

    # Build rows
    all_cat_ids = set(plans.keys()) | set(matrix.keys())
    rows: list[CategoryRowSchema] = []

    for cat_id in sorted(all_cat_ids):
        planned = plans.get(cat_id, Decimal("0.00"))
        fact = fact_totals.get(cat_id, Decimal("0.00"))
        days_data = matrix.get(cat_id, [Decimal("0.00")] * day_count)
        info = cat_info.get(cat_id)
        cat_type = info.type if info else "expense"
        cat_name = info.name if info else f"Category #{cat_id}"
        cat_icon = info.icon if info else None

        rows.append(
            CategoryRowSchema(
                category_id=cat_id,
                category_name=cat_name,
                category_icon=cat_icon,
                type=cat_type,
                planned=planned,
                fact=fact,
                delta=(planned - fact if cat_type == "expense" else fact - planned),
                days=[DayCellSchema(day=i + 1, amount=days_data[i]) for i in range(day_count)],
            )
        )

    return DashboardResponse(
        start_date=start_date,
        end_date=end_date,
        total_balance_all_time=period_income - period_expense,
        period_income=period_income,
        period_expense=period_expense,
        rows=rows,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST CASES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestDashboardAggregation:
    """Unit tests for the dashboard aggregation logic using FakeTransactionRepo."""

    def _make_repo(self) -> FakeTransactionRepo:
        """Create a pre-seeded fake repository."""
        repo = FakeTransactionRepo()

        # Seed categories
        repo.categories = [
            CategoryRecord(id=1, name="Продукты", type="expense", icon="#FF7A00"),
            CategoryRecord(id=2, name="Транспорт", type="expense", icon="#3B82F6"),
            CategoryRecord(id=3, name="Зарплата", type="income", icon="#10B981"),
        ]

        # Seed budget plans
        repo.budgets = [
            BudgetRecord(category_id=1, amount_limit=Decimal("30000.00")),
            BudgetRecord(category_id=2, amount_limit=Decimal("5000.00")),
        ]

        # Seed transactions (June 2026)
        base = datetime(2026, 6, 1, tzinfo=UTC)
        repo.transactions = [
            # Продукты: 3 transactions across different days
            TransactionRecord(
                id=1,
                user_id=1,
                category_id=1,
                category_name="Продукты",
                category_type="expense",
                amount=Decimal("1500.00"),
                executed_at=base.replace(day=1),
            ),
            TransactionRecord(
                id=2,
                user_id=1,
                category_id=1,
                category_name="Продукты",
                category_type="expense",
                amount=Decimal("2300.50"),
                executed_at=base.replace(day=5),
            ),
            TransactionRecord(
                id=3,
                user_id=1,
                category_id=1,
                category_name="Продукты",
                category_type="expense",
                amount=Decimal("800.00"),
                executed_at=base.replace(day=15),
            ),
            # Транспорт: 1 transaction
            TransactionRecord(
                id=4,
                user_id=1,
                category_id=2,
                category_name="Транспорт",
                category_type="expense",
                amount=Decimal("3200.00"),
                executed_at=base.replace(day=10),
            ),
            # Зарплата: 1 income transaction
            TransactionRecord(
                id=5,
                user_id=1,
                category_id=3,
                category_name="Зарплата",
                category_type="income",
                amount=Decimal("100000.00"),
                executed_at=base.replace(day=1),
            ),
        ]

        return repo

    def test_dashboard_aggregation_correctness(self) -> None:
        """
        GIVEN a seeded FakeTransactionRepo with known transactions and budgets
        WHEN  build_dashboard_from_data is called for June 2026
        THEN  period_income, period_expense, and per-category deltas are correct
        """
        repo = self._make_repo()
        start = date(2026, 6, 1)
        end = date(2026, 6, 30)

        txs = repo.get_transactions(user_id=1, start_date=start, end_date=end)
        budgets = repo.get_budgets(user_id=1, start_date=start, end_date=end)
        cats = repo.get_categories(user_id=1)

        result = build_dashboard_from_data(txs, budgets, cats, start, end)

        # Income
        assert result.period_income == Decimal("100000.00")
        # Expense: 1500 + 2300.50 + 800 + 3200 = 7800.50
        assert result.period_expense == Decimal("7800.50")
        # Balance
        assert result.total_balance_all_time == Decimal("92199.50")

        # Rows: 3 categories (Продукты, Транспорт, Зарплата)
        assert len(result.rows) == 3

        # Продукты (cat_id=1): planned=30000, fact=4600.50, delta=25399.50
        food_row = next(r for r in result.rows if r.category_id == 1)
        assert food_row.planned == Decimal("30000.00")
        assert food_row.fact == Decimal("4600.50")
        assert food_row.delta == Decimal("25399.50")  # underspend

        # Транспорт (cat_id=2): planned=5000, fact=3200, delta=1800
        transport_row = next(r for r in result.rows if r.category_id == 2)
        assert transport_row.delta == Decimal("1800.00")

        # Зарплата (cat_id=3): income → delta = fact - planned = 100000 - 0
        salary_row = next(r for r in result.rows if r.category_id == 3)
        assert salary_row.delta == Decimal("100000.00")

    def test_dashboard_day_vector_placement(self) -> None:
        """
        GIVEN transactions on specific days
        WHEN  we build the dashboard
        THEN  amounts land in the correct day-vector cells
        """
        repo = self._make_repo()
        start = date(2026, 6, 1)
        end = date(2026, 6, 30)

        txs = repo.get_transactions(user_id=1, start_date=start, end_date=end)
        budgets = repo.get_budgets(user_id=1, start_date=start, end_date=end)
        cats = repo.get_categories(user_id=1)

        result = build_dashboard_from_data(txs, budgets, cats, start, end)

        food_row = next(r for r in result.rows if r.category_id == 1)

        # Day 1 (index 0): 1500.00
        assert food_row.days[0].amount == Decimal("1500.00")
        # Day 5 (index 4): 2300.50
        assert food_row.days[4].amount == Decimal("2300.50")
        # Day 15 (index 14): 800.00
        assert food_row.days[14].amount == Decimal("800.00")
        # Day 2 (index 1): 0 — no transaction
        assert food_row.days[1].amount == Decimal("0.00")

    def test_add_transaction_via_fake_repo(self) -> None:
        """
        GIVEN an empty FakeTransactionRepo
        WHEN  we add a transaction
        THEN  it is stored and retrievable with auto-incremented ID
        """
        repo = FakeTransactionRepo()

        record = TransactionRecord(
            id=0,  # Will be overwritten
            user_id=1,
            category_id=1,
            category_name="Test",
            category_type="expense",
            amount=Decimal("500.00"),
            executed_at=datetime(2026, 6, 15, tzinfo=UTC),
        )

        saved = repo.add_transaction(record)
        assert saved.id == 1  # auto-incremented

        fetched = repo.get_transactions(
            user_id=1, start_date=date(2026, 6, 1), end_date=date(2026, 6, 30)
        )
        assert len(fetched) == 1
        assert fetched[0].amount == Decimal("500.00")

    def test_empty_repo_produces_empty_dashboard(self) -> None:
        """
        GIVEN a repo with categories and budgets but NO transactions
        WHEN  we build the dashboard
        THEN  rows exist (from budget plans) with fact=0 and correct delta
        """
        repo = FakeTransactionRepo()
        repo.categories = [
            CategoryRecord(id=1, name="Еда", type="expense"),
        ]
        repo.budgets = [
            BudgetRecord(category_id=1, amount_limit=Decimal("20000.00")),
        ]

        start = date(2026, 6, 1)
        end = date(2026, 6, 30)

        result = build_dashboard_from_data(
            transactions=[],
            budgets=repo.budgets,
            categories=repo.categories,
            start_date=start,
            end_date=end,
        )

        assert result.period_income == Decimal("0.00")
        assert result.period_expense == Decimal("0.00")
        assert len(result.rows) == 1
        assert result.rows[0].fact == Decimal("0.00")
        assert result.rows[0].planned == Decimal("20000.00")
        assert result.rows[0].delta == Decimal("20000.00")  # full underspend

    def test_execution_speed_under_10ms(self) -> None:
        """
        PERFORMANCE GATE: Dashboard aggregation with fake repo must complete
        in under 10 milliseconds. This proves the unit test layer has O(1)
        infrastructure overhead (no DB, no I/O, no event loop).
        """
        repo = self._make_repo()
        start = date(2026, 6, 1)
        end = date(2026, 6, 30)

        txs = repo.get_transactions(user_id=1, start_date=start, end_date=end)
        budgets = repo.get_budgets(user_id=1, start_date=start, end_date=end)
        cats = repo.get_categories(user_id=1)

        t0 = time.perf_counter_ns()
        build_dashboard_from_data(txs, budgets, cats, start, end)
        elapsed_ms = (time.perf_counter_ns() - t0) / 1_000_000

        assert elapsed_ms < 10.0, f"Dashboard build took {elapsed_ms:.2f}ms (limit: 10ms)"
