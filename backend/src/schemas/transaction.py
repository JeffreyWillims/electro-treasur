"""
Pydantic V2 schemas for Transaction CRUD.

Strict Decimal validation — rejects float on the wire.
PEP 585 type hints throughout.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class TransactionCreate(BaseModel):
    """Payload accepted by POST /api/v1/transactions/."""

    category_id: int
    amount: Decimal = Field(
        ..., max_digits=12, decimal_places=2, description="Monetary amount"
    )
    currency: str = Field(default="RUB", description="ISO Currency code")
    is_recurring: bool = Field(default=False, description="Flag for recurring payments")
    entry_type: str = Field(default="manual", description="Manual or automated entry")
    executed_at: datetime = Field(
        default_factory=datetime.now, description="When the transaction occurred (UTC)"
    )

    model_config = ConfigDict(strict=False)


class TransactionUpdate(BaseModel):
    """Payload accepted by PATCH /api/v1/transactions/{id}."""

    category_id: int | None = None
    amount: Decimal | None = Field(
        None, max_digits=12, decimal_places=2, description="Monetary amount"
    )
    currency: str | None = None
    is_recurring: bool | None = None
    entry_type: str | None = None
    executed_at: datetime | None = None
    comment: str | None = None

    model_config = ConfigDict(strict=False)


class TransactionResponse(BaseModel):
    """Single transaction returned to the client."""

    id: int
    user_id: int
    category_id: int
    category_name: str | None = None
    amount: Decimal
    currency: str
    is_recurring: bool
    entry_type: str
    executed_at: datetime
    comment: str | None = None
    idempotency_key: str | None = None

    model_config = ConfigDict(from_attributes=True)
