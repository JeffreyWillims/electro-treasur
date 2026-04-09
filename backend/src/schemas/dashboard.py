"""
Pydantic V2 schemas for the Dashboard aggregation endpoint.

The matrix is:  Category → Plan → Fact → Delta → list[31 day cells]
Each day cell holds the actual spend for that day-of-month (0-indexed → day 1 at index 0).

Time Complexity of building the response: O(N) where N = number of transactions in the month.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DayCellSchema(BaseModel):
    """Single day's aggregated amount within the 31-day vector."""

    day: int = Field(..., ge=1, le=31, description="Day of month (1-31)")
    amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)


class CategoryRowSchema(BaseModel):
    """
    One row of the budget matrix.

    Dynamic rows now correspond to the selected date range.
    Delta = planned - fact.  Positive delta means under-spend.
    """

    category_id: int
    category_name: str
    type: str | None = None
    planned: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    fact: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    delta: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    days: list[DayCellSchema] = Field(
        ..., description="Dynamic array of cells depending on bucketing length"
    )


class DashboardResponse(BaseModel):
    """
    Full monthly budget dashboard returned by GET /api/v1/dashboard/.

    Contains one CategoryRowSchema per budget-plan category, including
    categories with zero transactions (they still appear with plan data).
    """

    month: int | None = Field(default=None)
    year: int | None = Field(default=None)
    start_date: date | None = None
    end_date: date | None = None
    total_balance_all_time: Decimal = Field(
        default=Decimal("0.00"), max_digits=12, decimal_places=2
    )
    period_income: Decimal = Field(
        default=Decimal("0.00"), max_digits=12, decimal_places=2
    )
    period_expense: Decimal = Field(
        default=Decimal("0.00"), max_digits=12, decimal_places=2
    )
    rows: list[CategoryRowSchema]

    model_config = ConfigDict(from_attributes=True)
