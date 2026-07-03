"""
tests/unit/test_schemas.py — Pydantic V2 Schema Validation Tests.

Tests input validation boundaries: max_digits, decimal_places, field defaults,
model_dump(exclude_unset), and ConfigDict(from_attributes) for ORM roundtrip.

Pure unit tests — no DB, no I/O.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from src.schemas.transaction import (
    TransactionCreate,
    TransactionPaginatedResponse,
    TransactionResponse,
    TransactionUpdate,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TransactionCreate
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionCreate:
    """Validate TransactionCreate schema boundaries."""

    def test_minimal_valid_payload(self) -> None:
        """category_id + amount is the minimum required payload."""
        schema = TransactionCreate(category_id=1, amount=Decimal("100.00"))
        assert schema.category_id == 1
        assert schema.amount == Decimal("100.00")
        assert schema.currency == "RUB"
        assert schema.is_recurring is False
        assert schema.entry_type == "manual"

    def test_amount_with_decimal_places(self) -> None:
        """Amount with 2 decimal places should be accepted."""
        schema = TransactionCreate(category_id=1, amount=Decimal("1234.56"))
        assert schema.amount == Decimal("1234.56")

    def test_amount_zero_is_valid(self) -> None:
        """Zero amount should be valid (correction entries)."""
        schema = TransactionCreate(category_id=1, amount=Decimal("0"))
        assert schema.amount == Decimal("0")

    def test_large_amount_within_12_digits(self) -> None:
        """NUMERIC(12,2) allows up to 9999999999.99."""
        schema = TransactionCreate(category_id=1, amount=Decimal("9999999999.99"))
        assert schema.amount == Decimal("9999999999.99")

    def test_amount_exceeding_max_digits_raises(self) -> None:
        """Amount with more than 12 total digits should fail validation."""
        with pytest.raises(ValidationError):
            TransactionCreate(category_id=1, amount=Decimal("99999999999.99"))

    def test_amount_too_many_decimal_places_raises(self) -> None:
        """Amount with more than 2 decimal places should fail."""
        with pytest.raises(ValidationError):
            TransactionCreate(category_id=1, amount=Decimal("100.999"))

    def test_missing_category_id_raises(self) -> None:
        """category_id is required."""
        with pytest.raises(ValidationError):
            TransactionCreate(amount=Decimal("100"))  # type: ignore[call-arg]

    def test_missing_amount_raises(self) -> None:
        """amount is required."""
        with pytest.raises(ValidationError):
            TransactionCreate(category_id=1)  # type: ignore[call-arg]

    def test_custom_currency(self) -> None:
        """Currency can be overridden."""
        schema = TransactionCreate(
            category_id=1, amount=Decimal("50.00"), currency="USD"
        )
        assert schema.currency == "USD"

    def test_executed_at_auto_populated(self) -> None:
        """executed_at should default to now() if not provided."""
        schema = TransactionCreate(category_id=1, amount=Decimal("100"))
        assert isinstance(schema.executed_at, datetime)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TransactionUpdate
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionUpdate:
    """Validate TransactionUpdate — partial updates via exclude_unset."""

    def test_empty_update_is_valid(self) -> None:
        """All fields are optional — empty update is valid."""
        schema = TransactionUpdate()
        dumped = schema.model_dump(exclude_unset=True)
        assert dumped == {}

    def test_partial_update_amount_only(self) -> None:
        """Only changed fields should appear in model_dump(exclude_unset=True)."""
        schema = TransactionUpdate(amount=Decimal("999.99"))
        dumped = schema.model_dump(exclude_unset=True)
        assert dumped == {"amount": Decimal("999.99")}
        assert "category_id" not in dumped

    def test_partial_update_comment(self) -> None:
        """Comment update alone should work."""
        schema = TransactionUpdate(comment="Кофе в Шоколаднице")
        dumped = schema.model_dump(exclude_unset=True)
        assert dumped == {"comment": "Кофе в Шоколаднице"}

    def test_update_amount_too_many_decimals_raises(self) -> None:
        """Decimal places validation should apply to updates too."""
        with pytest.raises(ValidationError):
            TransactionUpdate(amount=Decimal("100.123"))

    def test_null_values_are_valid(self) -> None:
        """Explicitly setting None should be different from not setting."""
        schema = TransactionUpdate(comment=None)
        dumped = schema.model_dump(exclude_unset=True)
        assert "comment" in dumped
        assert dumped["comment"] is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TransactionResponse (from_attributes for ORM)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionResponse:
    """Validate TransactionResponse — ORM serialization."""

    def test_from_dict(self) -> None:
        """Should construct from a plain dict (API testing)."""
        resp = TransactionResponse(
            id=1,
            user_id=42,
            category_id=5,
            amount=Decimal("250.00"),
            currency="RUB",
            is_recurring=False,
            entry_type="manual",
            executed_at=datetime(2026, 6, 15, 12, 0, 0),
        )
        assert resp.id == 1
        assert resp.amount == Decimal("250.00")
        assert resp.category_name is None  # optional, defaults to None

    def test_optional_fields_have_defaults(self) -> None:
        """category_name, comment, idempotency_key default to None."""
        resp = TransactionResponse(
            id=1,
            user_id=1,
            category_id=1,
            amount=Decimal("1"),
            currency="RUB",
            is_recurring=False,
            entry_type="manual",
            executed_at=datetime.now(),
        )
        assert resp.category_name is None
        assert resp.comment is None
        assert resp.idempotency_key is None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TransactionPaginatedResponse
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionPaginatedResponse:
    """Validate paginated response envelope."""

    def test_empty_page(self) -> None:
        """Empty result should return items=[] and total=0."""
        resp = TransactionPaginatedResponse(items=[], total=0)
        assert resp.items == []
        assert resp.total == 0

    def test_page_with_items(self) -> None:
        """Should accept a list of TransactionResponse objects."""
        item = TransactionResponse(
            id=1,
            user_id=1,
            category_id=1,
            amount=Decimal("100"),
            currency="RUB",
            is_recurring=False,
            entry_type="manual",
            executed_at=datetime.now(),
        )
        resp = TransactionPaginatedResponse(items=[item], total=1)
        assert len(resp.items) == 1
        assert resp.total == 1
