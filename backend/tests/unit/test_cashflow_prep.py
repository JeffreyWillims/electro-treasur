"""Unit tests for cashflow_prep pure helpers (no DB)."""

from __future__ import annotations

from datetime import date

import pytest

from src.services.cashflow_prep import previous_month_range


@pytest.mark.parametrize(
    "today, expected",
    [
        # Mid-month → whole previous month
        (date(2026, 7, 3), (date(2026, 6, 1), date(2026, 6, 30))),
        # January → December of the previous year (year rollover)
        (date(2026, 1, 15), (date(2025, 12, 1), date(2025, 12, 31))),
        (date(2026, 1, 1), (date(2025, 12, 1), date(2025, 12, 31))),
        # March → February, non-leap year (28 days)
        (date(2026, 3, 10), (date(2026, 2, 1), date(2026, 2, 28))),
        # March → February, leap year (29 days)
        (date(2024, 3, 10), (date(2024, 2, 1), date(2024, 2, 29))),
        # Last day of a month
        (date(2026, 5, 31), (date(2026, 4, 1), date(2026, 4, 30))),
    ],
)
def test_previous_month_range(today: date, expected: tuple[date, date]) -> None:
    assert previous_month_range(today) == expected
