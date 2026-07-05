"""
Tax Calculator — чистая доменная математика налогов Самозанятых/ИП (РФ).

Режимы:
  • НПД (самозанятые): 4% — доход от физлиц, 6% — от юрлиц/ИП.
  • УСН «Доходы»: 6%.
  • УСН «Доходы − Расходы»: 15%, но не меньше минимального налога 1% от доходов.

Никакого I/O — только Decimal-арифметика (банковское округление до копейки
ROUND_HALF_UP). Доходная база собирается из категорий через
`taxable_income` (совместимо со снимками TransactionData движка инсайтов).
"""

from __future__ import annotations

import enum
from collections.abc import Sequence
from decimal import ROUND_HALF_UP, Decimal

from src.domain.models import CategoryType
from src.services.insight_engine import TransactionData


class TaxRegime(enum.StrEnum):
    """Налоговый режим плательщика."""

    npd_individuals = "npd_individuals"  # Самозанятый, доход от физлиц
    npd_companies = "npd_companies"  # Самозанятый, доход от юрлиц/ИП
    usn_income = "usn_income"  # ИП, УСН «Доходы»
    usn_income_minus_expense = "usn_income_minus_expense"  # ИП, УСН «Д − Р»


RATES: dict[TaxRegime, Decimal] = {
    TaxRegime.npd_individuals: Decimal("0.04"),
    TaxRegime.npd_companies: Decimal("0.06"),
    TaxRegime.usn_income: Decimal("0.06"),
    TaxRegime.usn_income_minus_expense: Decimal("0.15"),
}

# УСН «Д − Р»: минимальный налог — 1% от доходов (ст. 346.18 НК РФ).
USN_MIN_TAX_RATE = Decimal("0.01")

_KOPEK = Decimal("0.01")


def _to_kopek(value: Decimal) -> Decimal:
    """Округление до копейки, HALF_UP."""
    return value.quantize(_KOPEK, rounding=ROUND_HALF_UP)


def taxable_income(transactions: Sequence[TransactionData]) -> Decimal:
    """Доходная база: сумма транзакций по категориям типа income."""
    return sum(
        (tx.amount for tx in transactions if tx.category_type is CategoryType.income),
        Decimal("0"),
    )


def calculate_tax(
    regime: TaxRegime,
    income: Decimal,
    expenses: Decimal = Decimal("0"),
) -> Decimal:
    """
    Налог к уплате за период для выбранного режима.

    Raises:
        ValueError: отрицательный доход или расходы.
    """
    if income < 0:
        raise ValueError("Income cannot be negative")
    if expenses < 0:
        raise ValueError("Expenses cannot be negative")

    if regime is TaxRegime.usn_income_minus_expense:
        base = max(income - expenses, Decimal("0"))
        regular_tax = base * RATES[regime]
        min_tax = income * USN_MIN_TAX_RATE
        return _to_kopek(max(regular_tax, min_tax))

    return _to_kopek(income * RATES[regime])
