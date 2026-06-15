"""
tests/unit/test_budget_math.py — Property-Based Testing with Hypothesis.

Tests the pure `calculate_safe_to_spend` function — the core budget math
that determines how much a user can safely spend per day for the rest
of the month without exceeding their budget envelope limits.

Architecture:
  ┌─────────────────────────────────────────────────────┐
  │  Unit Test Layer (NO database, NO I/O)              │
  │                                                     │
  │  @given(income, planned, overspent, days_left)      │
  │       ↓                                             │
  │  calculate_safe_to_spend(...)                       │
  │       ↓                                             │
  │  assert result >= 0                                 │
  │  assert no ZeroDivisionError                        │
  │  assert no OverflowError                            │
  └─────────────────────────────────────────────────────┘

Formula:
  safe_limit = max(0, (income - total_planned - total_overspent)) / days_left
  where days_left > 0; if days_left == 0 → return 0.0

This function is extracted as a pure function to enable unit testing
without database dependencies.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from hypothesis import given, settings
from hypothesis import strategies as st


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PURE FUNCTION UNDER TEST
# Extracted from SafeToSpend.tsx frontend logic → backend pure Python equivalent.
# This could live in src/services/budget_service.py in production.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def calculate_safe_to_spend(
    monthly_income: Decimal,
    total_planned: Decimal,
    total_overspent: Decimal,
    days_left: int,
) -> Decimal:
    """
    Calculate the daily safe-to-spend limit.

    Args:
        monthly_income: Total expected income for the month (≥ 0).
        total_planned: Sum of all budget envelope limits (≥ 0).
        total_overspent: Sum of amounts exceeding individual envelopes (≥ 0).
        days_left: Remaining days in the month (including today).

    Returns:
        Decimal: Non-negative daily spending limit, rounded to 2 decimal places.
        Returns Decimal("0") if days_left ≤ 0 or budget is exhausted.

    Invariants:
        • NEVER raises ZeroDivisionError (days_left=0 → 0).
        • NEVER returns a negative value.
        • Result precision ≤ 2 decimal places.
    """
    if days_left <= 0:
        return Decimal("0")

    remaining = monthly_income - total_planned - total_overspent
    daily_limit = remaining / days_left

    # Clamp to non-negative and round to 2 decimal places
    return max(Decimal("0"), daily_limit.quantize(Decimal("0.01")))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HYPOTHESIS STRATEGIES — constrained random generators
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Monetary values: realistic range from 0 to 10 million, 2 decimal places
money = st.decimals(
    min_value=Decimal("0"),
    max_value=Decimal("10_000_000"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)

# Days left: 0..31 (including edge case 0)
days = st.integers(min_value=0, max_value=31)

# Extreme money: test overflow protection with very large values
extreme_money = st.decimals(
    min_value=Decimal("0"),
    max_value=Decimal("999_999_999_999.99"),  # Max NUMERIC(12,2)
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST CASES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestSafeToSpendMath:
    """Property-based tests for the safe-to-spend calculation."""

    @given(income=money, planned=money, overspent=money, days_left=days)
    @settings(max_examples=500)
    def test_never_returns_negative(
        self,
        income: Decimal,
        planned: Decimal,
        overspent: Decimal,
        days_left: int,
    ) -> None:
        """
        PROPERTY: The daily limit is ALWAYS ≥ 0, regardless of inputs.

        Even if expenses exceed income (overspent > income - planned),
        the function must clamp to zero — never suggest negative spending.
        """
        result = calculate_safe_to_spend(income, planned, overspent, days_left)
        assert result >= Decimal("0"), f"Got negative result: {result}"

    @given(income=money, planned=money, overspent=money)
    @settings(max_examples=200)
    def test_zero_days_returns_zero(
        self,
        income: Decimal,
        planned: Decimal,
        overspent: Decimal,
    ) -> None:
        """
        PROPERTY: When days_left=0 (last day passed), result is always 0.

        This is the primary ZeroDivisionError guard.
        """
        result = calculate_safe_to_spend(income, planned, overspent, days_left=0)
        assert result == Decimal("0")

    @given(income=money, planned=money, overspent=money, days_left=days)
    @settings(max_examples=500)
    def test_result_has_at_most_two_decimal_places(
        self,
        income: Decimal,
        planned: Decimal,
        overspent: Decimal,
        days_left: int,
    ) -> None:
        """
        PROPERTY: Result precision is ≤ 2 decimal places.

        Financial calculations must not produce values like 1523.456789.
        """
        result = calculate_safe_to_spend(income, planned, overspent, days_left)
        # Check that quantizing to 2 places doesn't change the value
        assert result == result.quantize(Decimal("0.01"))

    @given(income=extreme_money, planned=extreme_money, overspent=extreme_money, days_left=days)
    @settings(max_examples=100)
    def test_handles_extreme_values_without_overflow(
        self,
        income: Decimal,
        planned: Decimal,
        overspent: Decimal,
        days_left: int,
    ) -> None:
        """
        PROPERTY: Function handles NUMERIC(12,2) boundary values without
        raising OverflowError, InvalidOperation, or any other exception.
        """
        try:
            result = calculate_safe_to_spend(income, planned, overspent, days_left)
            assert isinstance(result, Decimal)
            assert result >= Decimal("0")
        except (OverflowError, InvalidOperation) as e:
            # This SHOULD NOT happen — if it does, the test fails
            raise AssertionError(
                f"Overflow with income={income}, planned={planned}, "
                f"overspent={overspent}, days_left={days_left}"
            ) from e

    def test_known_values_manual(self) -> None:
        """
        Deterministic test with known inputs and expected output.

        income=100_000, planned=60_000, overspent=5_000, days_left=10
        → remaining = 100_000 - 60_000 - 5_000 = 35_000
        → daily = 35_000 / 10 = 3_500.00
        """
        result = calculate_safe_to_spend(
            monthly_income=Decimal("100000"),
            total_planned=Decimal("60000"),
            total_overspent=Decimal("5000"),
            days_left=10,
        )
        assert result == Decimal("3500.00")

    def test_overspent_exceeds_income(self) -> None:
        """
        When total spending exceeds income, result is clamped to 0.

        income=50_000, planned=40_000, overspent=20_000
        → remaining = 50_000 - 40_000 - 20_000 = -10_000
        → clamped to 0
        """
        result = calculate_safe_to_spend(
            monthly_income=Decimal("50000"),
            total_planned=Decimal("40000"),
            total_overspent=Decimal("20000"),
            days_left=15,
        )
        assert result == Decimal("0")

    def test_negative_days_returns_zero(self) -> None:
        """Edge case: negative days (shouldn't happen, but must not crash)."""
        result = calculate_safe_to_spend(
            monthly_income=Decimal("100000"),
            total_planned=Decimal("50000"),
            total_overspent=Decimal("0"),
            days_left=-5,
        )
        assert result == Decimal("0")
