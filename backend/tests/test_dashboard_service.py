"""
Unit tests for the dashboard aggregation logic.

Tests the O(N) single-pass algorithm WITHOUT a real database —
we directly test the data-structure transformation.
"""

from __future__ import annotations

from decimal import Decimal

from src.schemas.dashboard import CategoryRowSchema, DayCellSchema


def _build_matrix(
    tx_rows: list[tuple[int, int, float]],
    plans: dict[int, Decimal],
    cat_names: dict[int, str],
    day_count: int = 31,
) -> list[CategoryRowSchema]:
    """
    Pure-function mirror of dashboard_service.get_monthly_dashboard
    aggregation logic — no DB, no async, testable in isolation.

    Time:  O(N + K).
    Space: O(K * day_count).  day_count defaults to 31 for standard months.
    """
    matrix: dict[int, list[Decimal]] = {}
    fact_totals: dict[int, Decimal] = {}

    # O(N) pass
    for cat_id, day_num, total in tx_rows:
        cat_id = int(cat_id)
        day_index = int(day_num) - 1
        if day_index < 0 or day_index >= day_count:
            continue  # timezone-guard mirrors the real service
        if cat_id not in matrix:
            matrix[cat_id] = [Decimal("0.00")] * day_count
            fact_totals[cat_id] = Decimal("0.00")
        matrix[cat_id][day_index] += Decimal(str(total))
        fact_totals[cat_id] += Decimal(str(total))

    # O(K) merge
    all_cat_ids = sorted(set(plans.keys()) | set(matrix.keys()))
    rows: list[CategoryRowSchema] = []
    for cat_id in all_cat_ids:
        planned = plans.get(cat_id, Decimal("0.00"))
        fact = fact_totals.get(cat_id, Decimal("0.00"))
        days_data = matrix.get(cat_id, [Decimal("0.00")] * day_count)
        rows.append(
            CategoryRowSchema(
                category_id=cat_id,
                category_name=cat_names.get(cat_id, f"Category #{cat_id}"),
                planned=planned,
                fact=fact,
                delta=planned - fact,
                days=[
                    DayCellSchema(day=i + 1, amount=days_data[i])
                    for i in range(day_count)
                ],
            )
        )
    return rows


class TestDashboardAggregation:
    """Verify the O(N) aggregation algorithm correctness."""

    def test_single_pass_accumulation(self, sample_tx_rows: list) -> None:
        """Day amounts accumulate correctly within same category+day."""
        plans = {1: Decimal("5000.00"), 2: Decimal("25000.00"), 3: Decimal("6000.00")}
        names = {1: "Продукты", 2: "Ипотека", 3: "Транспорт"}

        rows = _build_matrix(sample_tx_rows, plans, names)

        assert len(rows) == 3

        # Category 1 (Продукты): fact = 1500 + 750.50 + 200 = 2450.50
        cat1 = rows[0]
        assert cat1.category_name == "Продукты"
        assert cat1.fact == Decimal("2450.50")
        assert cat1.delta == Decimal("2549.50")  # 5000 - 2450.50
        assert cat1.days[0].amount == Decimal("1500.00")  # day 1
        assert cat1.days[2].amount == Decimal("750.50")  # day 3

        # Category 2 (Ипотека): fact = 24897.54
        cat2 = rows[1]
        assert cat2.fact == Decimal("24897.54")
        assert cat2.delta == Decimal("102.46")  # 25000 - 24897.54

        # Category 3 (Транспорт): day 10 has two rows → 3000 + 500 = 3500
        cat3 = rows[2]
        assert cat3.days[9].amount == Decimal("3500.00")
        assert cat3.fact == Decimal("4700.00")  # 3500 + 1200

    def test_31_day_vector_length(self, sample_tx_rows: list) -> None:
        """Every row must produce exactly day_count day cells (default 31)."""
        rows = _build_matrix(sample_tx_rows, {}, {}, day_count=31)
        for row in rows:
            assert len(row.days) == 31

    def test_61_day_vector_length(self, sample_tx_rows: list) -> None:
        """Dynamic bucketing: 61-day range produces 61-cell vectors."""
        rows = _build_matrix(sample_tx_rows, {}, {}, day_count=61)
        for row in rows:
            assert len(row.days) == 61

    def test_empty_transactions(self) -> None:
        """Categories with plans but no transactions appear with zero fact."""
        plans = {99: Decimal("10000.00")}
        names = {99: "Отпуск"}
        rows = _build_matrix([], plans, names)

        assert len(rows) == 1
        assert rows[0].fact == Decimal("0.00")
        assert rows[0].delta == Decimal("10000.00")
        assert all(d.amount == Decimal("0.00") for d in rows[0].days)
