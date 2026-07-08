"""Schemas for the tax reference search (Справочник налоговых норм)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class TaxRuleResult(BaseModel):
    """Одна норма в результатах поиска/списка."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    title: str
    body: str
    source: str | None
