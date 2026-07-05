"""Pydantic V2 schemas for bank deposit offers (Savings Navigator CPA)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BankOfferRead(BaseModel):
    """Public offer card — no click counters exposed."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    rate: Decimal
    color: str
    partner_url: str | None
