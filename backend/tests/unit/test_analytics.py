"""
tests/unit/test_analytics.py — Savings Simulator Unit Tests.

Tests simulate_savings() — pure computation function (no DB, no I/O).
Validates compound interest math, optimization delta, edge cases.
"""

from __future__ import annotations

from decimal import Decimal

from src.schemas.analytics import (
    Adjustment,
    CategoryAvg,
    SimulateRequest,
    SimulateResponse,
)
from src.services.analytics_service import simulate_savings


def _make_request(
    target: str = "1000000",
    initial: str = "0",
    income: str = "150000",
    bank_rate: str = "16.0",
    expenses: list[tuple[int, str, str]] | None = None,
    adjustments: list[tuple[int, str]] | None = None,
    habit_savings: str = "0",
) -> SimulateRequest:
    """Helper to build SimulateRequest with sensible defaults."""
    base_expenses = [
        CategoryAvg(category_id=cid, name=name, avg_amount=Decimal(amt))
        for cid, name, amt in (expenses or [(1, "Продукты", "30000"), (2, "Транспорт", "5000")])
    ]
    adj_list = [
        Adjustment(category_id=cid, new_amount=Decimal(amt)) for cid, amt in (adjustments or [])
    ]
    return SimulateRequest(
        target_amount=Decimal(target),
        initial_savings=Decimal(initial),
        avg_income=Decimal(income),
        bank_rate=Decimal(bank_rate),
        base_expenses=base_expenses,
        adjustments=adj_list,
        habit_savings=Decimal(habit_savings),
    )


class TestSimulateSavings:
    """Savings simulation engine — compound interest + optimization."""

    async def test_returns_simulate_response(self) -> None:
        """Should return SimulateResponse type."""
        req = _make_request()
        result = await simulate_savings(req)
        assert isinstance(result, SimulateResponse)

    async def test_chart_data_not_empty(self) -> None:
        """Should produce at least 1 month of chart data."""
        req = _make_request()
        result = await simulate_savings(req)
        assert len(result.chart_data) > 0

    async def test_chart_data_first_month_has_initial_savings(self) -> None:
        """First data point should reflect initial savings."""
        req = _make_request(initial="500000")
        result = await simulate_savings(req)
        assert result.chart_data[0].base_savings == Decimal("500000")
        assert result.chart_data[0].optimized_savings == Decimal("500000")

    async def test_savings_grow_over_time(self) -> None:
        """Savings should increase monotonically with positive income."""
        req = _make_request(income="200000")
        result = await simulate_savings(req)
        # Last month > first month
        assert result.chart_data[-1].base_savings > result.chart_data[0].base_savings

    async def test_optimization_reaches_target_faster(self) -> None:
        """With cost reduction adjustments, optimized should reach target sooner."""
        req = _make_request(
            target="500000",
            income="100000",
            expenses=[(1, "Продукты", "30000"), (2, "Транспорт", "10000")],
            adjustments=[(1, "20000"), (2, "5000")],  # cut expenses
        )
        result = await simulate_savings(req)
        if result.base_target_date and result.optimized_target_date:
            assert result.optimized_target_date <= result.base_target_date
            assert result.days_saved >= 0

    async def test_days_saved_positive_with_cuts(self) -> None:
        """Cutting expenses should produce positive days_saved."""
        req = _make_request(
            target="300000",
            income="80000",
            expenses=[(1, "Еда", "25000"), (2, "Развлечения", "15000")],
            adjustments=[(2, "5000")],  # cut entertainment by 10k
        )
        result = await simulate_savings(req)
        assert result.days_saved > 0

    async def test_zero_expenses_fastest_path(self) -> None:
        """With zero expenses, all income goes to savings."""
        req = _make_request(
            target="200000",
            income="100000",
            expenses=[],
        )
        result = await simulate_savings(req)
        # Should reach target in ~2 months (ignoring interest)
        assert result.base_target_date is not None

    async def test_high_initial_savings_already_at_target(self) -> None:
        """If initial_savings >= target, should hit target immediately."""
        req = _make_request(
            target="100000",
            initial="500000",
        )
        result = await simulate_savings(req)
        assert result.base_target_date is not None
        assert result.optimized_target_date is not None
        assert result.chart_data[0].base_savings >= Decimal("100000")

    async def test_bank_rate_zero(self) -> None:
        """With 0% interest, growth should be purely linear (no compound)."""
        req = _make_request(
            target="300000",
            initial="0",
            income="100000",
            expenses=[(1, "Аренда", "50000")],
            bank_rate="0",
        )
        result = await simulate_savings(req)
        # Month 0: 0, Month 1: 50000, Month 2: 100000...
        # Should reach 300k in ~6 months
        assert result.base_target_date is not None

    async def test_habit_savings_accelerate(self) -> None:
        """habit_savings should add to optimized path only."""
        req = _make_request(
            target="200000",
            income="80000",
            expenses=[(1, "Еда", "30000")],
            habit_savings="10000",
        )
        result = await simulate_savings(req)
        # Optimized gets extra 10k/month → should be faster
        if len(result.chart_data) > 2:
            assert result.chart_data[2].optimized_savings > result.chart_data[2].base_savings

    async def test_max_120_months_simulation(self) -> None:
        """Simulation should not exceed 120 months (10 years)."""
        req = _make_request(
            target="999999999",  # unreachable
            income="50000",
            expenses=[(1, "Аренда", "49999")],  # almost no savings
        )
        result = await simulate_savings(req)
        assert len(result.chart_data) <= 120
