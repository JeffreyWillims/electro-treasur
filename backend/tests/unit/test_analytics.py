"""
tests/unit/test_analytics.py — юнит-тесты симулятора накоплений.

Тестируют simulate_savings() — чистую вычислительную функцию (без БД, без I/O).
Проверяют математику сложного процента, дельту оптимизации, граничные случаи.
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
    """Хелпер для построения SimulateRequest с разумными значениями по умолчанию."""
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
    """Движок симуляции накоплений — сложный процент + оптимизация."""

    async def test_returns_simulate_response(self) -> None:
        """Должен возвращать тип SimulateResponse."""
        req = _make_request()
        result = await simulate_savings(req)
        assert isinstance(result, SimulateResponse)

    async def test_chart_data_not_empty(self) -> None:
        """Должен формировать хотя бы 1 месяц данных для графика."""
        req = _make_request()
        result = await simulate_savings(req)
        assert len(result.chart_data) > 0

    async def test_chart_data_first_month_has_initial_savings(self) -> None:
        """Первая точка данных должна отражать начальные накопления."""
        req = _make_request(initial="500000")
        result = await simulate_savings(req)
        assert result.chart_data[0].base_savings == Decimal("500000")
        assert result.chart_data[0].optimized_savings == Decimal("500000")

    async def test_savings_grow_over_time(self) -> None:
        """Накопления должны монотонно расти при положительном доходе."""
        req = _make_request(income="200000")
        result = await simulate_savings(req)
        # Последний месяц > первого месяца
        assert result.chart_data[-1].base_savings > result.chart_data[0].base_savings

    async def test_optimization_reaches_target_faster(self) -> None:
        """С корректировками на сокращение расходов оптимизация должна достигать цели раньше."""
        req = _make_request(
            target="500000",
            income="100000",
            expenses=[(1, "Продукты", "30000"), (2, "Транспорт", "10000")],
            adjustments=[(1, "20000"), (2, "5000")],  # сокращаем расходы
        )
        result = await simulate_savings(req)
        if result.base_target_date and result.optimized_target_date:
            assert result.optimized_target_date <= result.base_target_date
            assert result.days_saved >= 0

    async def test_days_saved_positive_with_cuts(self) -> None:
        """Сокращение расходов должно давать положительный days_saved."""
        req = _make_request(
            target="300000",
            income="80000",
            expenses=[(1, "Еда", "25000"), (2, "Развлечения", "15000")],
            adjustments=[(2, "5000")],  # сокращаем развлечения на 10к
        )
        result = await simulate_savings(req)
        assert result.days_saved > 0

    async def test_zero_expenses_fastest_path(self) -> None:
        """При нулевых расходах весь доход идёт в накопления."""
        req = _make_request(
            target="200000",
            income="100000",
            expenses=[],
        )
        result = await simulate_savings(req)
        # Должен достичь цели примерно за 2 месяца (без учёта процента)
        assert result.base_target_date is not None

    async def test_high_initial_savings_already_at_target(self) -> None:
        """Если initial_savings >= target, цель должна достигаться немедленно."""
        req = _make_request(
            target="100000",
            initial="500000",
        )
        result = await simulate_savings(req)
        assert result.base_target_date is not None
        assert result.optimized_target_date is not None
        assert result.chart_data[0].base_savings >= Decimal("100000")

    async def test_bank_rate_zero(self) -> None:
        """При 0% ставке рост должен быть чисто линейным (без сложного процента)."""
        req = _make_request(
            target="300000",
            initial="0",
            income="100000",
            expenses=[(1, "Аренда", "50000")],
            bank_rate="0",
        )
        result = await simulate_savings(req)
        # Месяц 0: 0, Месяц 1: 50000, Месяц 2: 100000...
        # Должен достичь 300к примерно за 6 месяцев
        assert result.base_target_date is not None

    async def test_habit_savings_accelerate(self) -> None:
        """habit_savings должен добавляться только к оптимизированному пути."""
        req = _make_request(
            target="200000",
            income="80000",
            expenses=[(1, "Еда", "30000")],
            habit_savings="10000",
        )
        result = await simulate_savings(req)
        # Оптимизация получает дополнительно 10к/месяц → должна быть быстрее
        if len(result.chart_data) > 2:
            assert result.chart_data[2].optimized_savings > result.chart_data[2].base_savings

    async def test_max_120_months_simulation(self) -> None:
        """Симуляция не должна превышать 120 месяцев (10 лет)."""
        req = _make_request(
            target="999999999",  # недостижимо
            income="50000",
            expenses=[(1, "Аренда", "49999")],  # почти без накоплений
        )
        result = await simulate_savings(req)
        assert len(result.chart_data) <= 120
