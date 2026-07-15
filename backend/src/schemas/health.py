"""Pydantic V2-схемы индекса финансового здоровья."""

from __future__ import annotations

from pydantic import BaseModel


class HealthFactor(BaseModel):
    """One weighted component of the health score (0..100)."""

    name: str
    score: int
    weight: float
    detail: str


class HealthScoreResponse(BaseModel):
    """Overall 0..100 financial health index with its factor breakdown."""

    score: int
    grade: str
    factors: list[HealthFactor]
