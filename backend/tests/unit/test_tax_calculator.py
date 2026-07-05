"""Unit tests for tax_calculator — pure math, no DB. Target: 100% coverage."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from src.domain.models import CategoryType
from src.services.insight_engine import TransactionData
from src.services.tax_calculator import (
    RATES,
    TaxRegime,
    calculate_tax,
    taxable_income,
)


def _tx(amount: str, category_type: CategoryType) -> TransactionData:
    return TransactionData(
        amount=Decimal(amount),
        category_id=1,
        category_type=category_type,
        executed_at=datetime(2026, 7, 1, tzinfo=UTC),
    )


# ── Ставки по режимам ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "regime, income, expected",
    [
        (TaxRegime.npd_individuals, "100000", "4000.00"),  # 4% от физлиц
        (TaxRegime.npd_companies, "100000", "6000.00"),  # 6% от юрлиц
        (TaxRegime.usn_income, "100000", "6000.00"),  # УСН «Доходы» 6%
        (TaxRegime.npd_individuals, "0", "0.00"),  # нулевой период
    ],
)
def test_income_based_regimes(regime: TaxRegime, income: str, expected: str) -> None:
    assert calculate_tax(regime, Decimal(income)) == Decimal(expected)


# ── УСН «Доходы − Расходы» ───────────────────────────────────────────────


def test_usn_dr_regular_tax() -> None:
    # (500000 − 300000) × 15% = 30000 > min 1% (5000)
    tax = calculate_tax(TaxRegime.usn_income_minus_expense, Decimal("500000"), Decimal("300000"))
    assert tax == Decimal("30000.00")


def test_usn_dr_min_tax_wins() -> None:
    # (500000 − 490000) × 15% = 1500 < min 1% от доходов (5000) → платим 5000
    tax = calculate_tax(TaxRegime.usn_income_minus_expense, Decimal("500000"), Decimal("490000"))
    assert tax == Decimal("5000.00")


def test_usn_dr_loss_pays_min_tax() -> None:
    # Убыток: база 0, но минимальный налог 1% от доходов остаётся
    tax = calculate_tax(TaxRegime.usn_income_minus_expense, Decimal("200000"), Decimal("350000"))
    assert tax == Decimal("2000.00")


def test_usn_dr_zero_income_zero_tax() -> None:
    assert calculate_tax(
        TaxRegime.usn_income_minus_expense, Decimal("0"), Decimal("0")
    ) == Decimal("0.00")


# ── Округление и валидация ───────────────────────────────────────────────


def test_rounding_half_up_to_kopek() -> None:
    # 333.33 × 4% = 13.3332 → 13.33; 333.45 × 4% = 13.338 → 13.34
    assert calculate_tax(TaxRegime.npd_individuals, Decimal("333.33")) == Decimal("13.33")
    assert calculate_tax(TaxRegime.npd_individuals, Decimal("333.45")) == Decimal("13.34")


def test_negative_income_raises() -> None:
    with pytest.raises(ValueError, match="Income"):
        calculate_tax(TaxRegime.usn_income, Decimal("-1"))


def test_negative_expenses_raises() -> None:
    with pytest.raises(ValueError, match="Expenses"):
        calculate_tax(TaxRegime.usn_income_minus_expense, Decimal("100"), Decimal("-1"))


def test_all_regimes_have_rates() -> None:
    assert set(RATES) == set(TaxRegime)


# ── Доходная база из категорий ───────────────────────────────────────────


def test_taxable_income_sums_only_income_categories() -> None:
    transactions = [
        _tx("150000", CategoryType.income),
        _tx("50000", CategoryType.income),
        _tx("99999", CategoryType.expense),  # расходы не входят в базу
    ]
    assert taxable_income(transactions) == Decimal("200000")


def test_taxable_income_empty() -> None:
    assert taxable_income([]) == Decimal("0")
