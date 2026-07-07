"""Pydantic V2 schemas for Savings Goals (режим «Цель»)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    """POST /v1/goals/ body."""

    name: str = Field(..., min_length=1, max_length=128)
    target_amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    target_date: date | None = None
    monthly_plan: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)


class GoalContribute(BaseModel):
    """PATCH /v1/goals/{id}/contribute body — сумма пополнения."""

    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)


class GoalResponse(BaseModel):
    """Цель + вычисленный прогресс."""

    id: int
    name: str
    target_amount: Decimal
    target_date: date | None
    monthly_plan: Decimal | None
    current_amount: Decimal
    created_at: datetime
    progress_pct: float  # 0..100, current/target, capped
    remaining: Decimal  # сколько осталось отложить (>= 0)
