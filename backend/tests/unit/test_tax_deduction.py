"""Unit: tax deduction calculator — pure, no DB, no LLM."""

from __future__ import annotations

from decimal import Decimal

import pytest

from src.services.tax_deduction_service import calculate_deduction


def test_treatment_within_limit() -> None:
    r = calculate_deduction("treatment", Decimal("50000"))
    assert r["eligible_base"] == Decimal("50000")
    assert r["refund"] == Decimal("6500.00")  # 13%
    assert r["capped_by_income"] is False


def test_treatment_capped_by_base_limit() -> None:
    r = calculate_deduction("treatment", Decimal("200000"))
    assert r["eligible_base"] == Decimal("150000")  # social cap
    assert r["refund"] == Decimal("19500.00")


def test_property_max_refund() -> None:
    r = calculate_deduction("property", Decimal("2500000"))
    assert r["refund"] == Decimal("260000.00")  # 13% of 2M cap


def test_mortgage_max_refund() -> None:
    assert calculate_deduction("mortgage", Decimal("5000000"))["refund"] == Decimal("390000.00")


def test_iis_max_refund() -> None:
    assert calculate_deduction("iis", Decimal("500000"))["refund"] == Decimal("52000.00")


def test_education_child_limit() -> None:
    r = calculate_deduction("education_child", Decimal("130000"))
    assert r["eligible_base"] == Decimal("110000")
    assert r["refund"] == Decimal("14300.00")


def test_refund_capped_by_ndfl_paid() -> None:
    # Расходы дают 19 500 ₽, но уплачено НДФЛ только 13 000 ₽ (доход 100 000).
    r = calculate_deduction("treatment", Decimal("150000"), annual_income=Decimal("100000"))
    assert r["refund"] == Decimal("13000.00")
    assert r["capped_by_income"] is True


def test_income_not_limiting_when_high() -> None:
    r = calculate_deduction("treatment", Decimal("150000"), annual_income=Decimal("1000000"))
    assert r["refund"] == Decimal("19500.00")
    assert r["capped_by_income"] is False


def test_unknown_kind_raises() -> None:
    with pytest.raises(KeyError):
        calculate_deduction("bitcoin", Decimal("1000"))
