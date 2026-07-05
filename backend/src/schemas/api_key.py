"""
Pydantic V2 schemas for API keys and the public /api/v2/public endpoints.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyCreateRequest(BaseModel):
    """POST /api-keys body."""

    name: str = Field(..., min_length=1, max_length=64, description="Human-readable key label")


class ApiKeyCreatedResponse(BaseModel):
    """Ответ на создание — единственный момент, когда виден полный ключ."""

    id: int
    name: str
    prefix: str
    api_key: str = Field(description="Полный ключ. Сохраните его — повторно не показывается.")


class ApiKeyInfo(BaseModel):
    """Ключ в списке (без секрета)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    prefix: str
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None = None


class PublicCategoryInfo(BaseModel):
    """Категория пользователя для внешнего сервиса."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str


class PublicTransactionCreate(BaseModel):
    """POST /v2/public/transactions body — транзакция от стороннего сервиса."""

    category_id: int
    amount: Decimal = Field(..., gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="RUB", max_length=3)
    comment: str | None = Field(default=None, max_length=255)
    executed_at: datetime | None = None
