"""
tests/unit/test_import_helpers.py — Import/Export Pure Function Tests.

Tests _resolve_columns (column aliasing) and _parse_amount (monetary parsing)
from import_export_service. Pure unit tests — no DB, no file I/O.
"""

from __future__ import annotations

from decimal import Decimal

import pandas as pd
import pytest

from src.services.import_export_service import _parse_amount, _resolve_columns


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _resolve_columns
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestResolveColumns:
    """Column alias resolution from import CSVs."""

    def test_english_standard_headers(self) -> None:
        """Standard English headers should map correctly."""
        df = pd.DataFrame(columns=["Date", "Amount", "Category", "Comment"])
        result = _resolve_columns(df)
        assert result["date"] == "Date"
        assert result["amount"] == "Amount"
        assert result["category"] == "Category"
        assert result["comment"] == "Comment"

    def test_russian_headers(self) -> None:
        """Russian column names should be recognized."""
        df = pd.DataFrame(columns=["Дата", "Сумма", "Категория", "Комментарий"])
        result = _resolve_columns(df)
        assert result["date"] == "Дата"
        assert result["amount"] == "Сумма"
        assert result["category"] == "Категория"
        assert result["comment"] == "Комментарий"

    def test_case_insensitive(self) -> None:
        """Column matching should be case-insensitive."""
        df = pd.DataFrame(columns=["DATE", "AMOUNT"])
        result = _resolve_columns(df)
        assert "date" in result
        assert "amount" in result

    def test_missing_required_column_raises(self) -> None:
        """Missing 'date' or 'amount' should raise ValueError."""
        df = pd.DataFrame(columns=["Category", "Comment"])
        with pytest.raises(ValueError, match="date"):
            _resolve_columns(df)

    def test_missing_amount_raises(self) -> None:
        """Missing 'amount' should raise ValueError."""
        df = pd.DataFrame(columns=["Date", "Category"])
        with pytest.raises(ValueError, match="amount"):
            _resolve_columns(df)

    def test_optional_columns_absent_ok(self) -> None:
        """Missing 'category' and 'comment' should not raise."""
        df = pd.DataFrame(columns=["Date", "Amount"])
        result = _resolve_columns(df)
        assert "date" in result
        assert "amount" in result
        assert "category" not in result
        assert "comment" not in result

    def test_whitespace_stripped(self) -> None:
        """Leading/trailing whitespace in column names should be handled."""
        df = pd.DataFrame(columns=["  Date  ", " Amount "])
        # Note: _resolve_columns expects df.columns.str.strip() to be called first
        df.columns = df.columns.str.strip()
        result = _resolve_columns(df)
        assert "date" in result
        assert "amount" in result

    def test_alias_executed_at(self) -> None:
        """'executed_at' should map to logical 'date'."""
        df = pd.DataFrame(columns=["executed_at", "value"])
        result = _resolve_columns(df)
        assert result["date"] == "executed_at"
        assert result["amount"] == "value"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _parse_amount
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestParseAmount:
    """Monetary value parsing from various string/numeric formats."""

    def test_integer(self) -> None:
        assert _parse_amount(1500) == Decimal("1500")

    def test_float(self) -> None:
        assert _parse_amount(1500.50) == Decimal("1500.5")

    def test_decimal_passthrough(self) -> None:
        assert _parse_amount(Decimal("999.99")) == Decimal("999.99")

    def test_string_with_spaces(self) -> None:
        assert _parse_amount("1 500.00") == Decimal("1500.00")

    def test_string_with_comma_decimal(self) -> None:
        """Russian format: comma as decimal separator."""
        assert _parse_amount("1500,50") == Decimal("1500.50")

    def test_negative_amount(self) -> None:
        assert _parse_amount("-500.00") == Decimal("-500.00")

    def test_string_with_spaces_and_comma(self) -> None:
        assert _parse_amount("  2 500,75  ") == Decimal("2500.75")

    def test_zero(self) -> None:
        assert _parse_amount(0) == Decimal("0")

    def test_large_amount(self) -> None:
        assert _parse_amount("9999999.99") == Decimal("9999999.99")
