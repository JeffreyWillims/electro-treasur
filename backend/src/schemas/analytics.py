"""Analytics schemas for Savings Navigator."""

from decimal import Decimal
from datetime import date
from pydantic import BaseModel, Field


class CategoryAvg(BaseModel):
    category_id: int
    name: str
    avg_amount: Decimal


class AnalyticsProfileResponse(BaseModel):
    categories: list[CategoryAvg]
    avg_income: Decimal


class Adjustment(BaseModel):
    category_id: int
    new_amount: Decimal


class SimulateRequest(BaseModel):
    target_amount: Decimal = Field(..., gt=0)
    initial_savings: Decimal = Field(default=Decimal("0"), ge=0)
    adjustments: list[Adjustment]
    bank_rate: Decimal = Field(
        ..., description="Annual interest rate, e.g. 16.0 for 16%"
    )
    avg_income: Decimal = Field(default=Decimal("0"))
    base_expenses: list[CategoryAvg] = Field(default_factory=list)
    habit_savings: Decimal = Field(default=Decimal("0"))


class SimulationDataPoint(BaseModel):
    month: str  # "YYYY-MM"
    base_savings: Decimal
    optimized_savings: Decimal


class SimulateResponse(BaseModel):
    base_target_date: date | None
    optimized_target_date: date | None
    days_saved: int = Field(default=0)
    chart_data: list[SimulationDataPoint]
