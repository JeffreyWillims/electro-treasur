"""
Pydantic V2-схемы эндпоинта агрегации дашборда.

Матрица: Категория → План → Факт → Дельта → список[N ячеек-дней].
Каждая ячейка дня хранит фактический расход для этого индекса корзины (день 1 — индекс 0).
Динамическое разбиение на корзины: длина вектора дней определяется в рантайме
выбранным диапазоном дат — валидны окна 7, 31, 90 и 365 дней.

Сложность построения ответа: O(N), где N — число транзакций в диапазоне.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DayCellSchema(BaseModel):
    """Single day's aggregated amount within the dynamic bucketing vector."""

    day: int = Field(..., ge=1, description="Day index in the selected range")
    amount: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)


class CategoryRowSchema(BaseModel):
    """
    One row of the budget matrix.

    Dynamic rows now correspond to the selected date range.
    Delta = planned - fact.  Positive delta means under-spend.
    """

    category_id: int
    category_name: str
    category_icon: str | None = None
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
    period_income: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    period_expense: Decimal = Field(default=Decimal("0.00"), max_digits=12, decimal_places=2)
    rows: list[CategoryRowSchema]

    model_config = ConfigDict(from_attributes=True)
