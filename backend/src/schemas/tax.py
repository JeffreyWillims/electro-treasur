"""Schemas for the tax reference search (Справочник налоговых норм)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TaxRuleResult(BaseModel):
    """Одна норма в результатах поиска/списка."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    title: str
    body: str
    source: str | None


class DeductionKind(BaseModel):
    """Вид вычета для выпадающего списка калькулятора."""

    kind: str
    label: str
    base_limit: Decimal
    note: str


class DeductionRequest(BaseModel):
    """POST /v1/tax/calc — расчёт возврата по одному вычету."""

    kind: str
    amount: Decimal = Field(..., ge=0, max_digits=12, decimal_places=2)
    annual_income: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)


class DeductionResult(BaseModel):
    kind: str
    label: str
    eligible_base: Decimal
    refund: Decimal
    base_limit: Decimal
    capped_by_income: bool
    note: str
