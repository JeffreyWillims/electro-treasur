"""
Pydantic V2 schemas for the Dashboard aggregation endpoint.

The matrix is:  Category → Plan → Fact → Delta → list[31 day cells]
Each day cell holds the actual spend for that day-of-month (0-indexed → day 1 at index 0).

Time Complexity of building the response: O(N) where N = number of transactions in the month.
"""
from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DayCellSchema(BaseModel):
    """Single day's aggregated amount within the 31-day vector."""

    day: int = Field(..., ge=1, le=31, description="Day of month (1-31)")
    amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)


class CategoryRowSchema(BaseModel):
    """
    One row of the budget matrix.

    Invariant: len(days) == 31.  Empty days carry amount=0.00.
    Delta = planned - fact.  Positive delta means under-spend.
    """

    category_id: int
    category_name: str
    planned: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    fact: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    delta: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    days: list[DayCellSchema] = Field(
        ..., min_length=31, max_length=31, description="Exactly 31 cells, day 1–31"
    )


class DashboardResponse(BaseModel):
    """
    Full monthly budget dashboard returned by GET /api/v1/dashboard/.

    Contains one CategoryRowSchema per budget-plan category, including
    categories with zero transactions (they still appear with plan data).
    """

    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)
    rows: list[CategoryRowSchema]

    model_config = ConfigDict(from_attributes=True)
