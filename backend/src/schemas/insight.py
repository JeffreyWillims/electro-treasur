"""
Pydantic V2 schemas for LLM Insight endpoints.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class InsightRequest(BaseModel):
    """POST /api/v1/insights/ body."""

    start_date: str
    end_date: str


class InsightEnqueueResponse(BaseModel):
    """HTTP 202 response after task is enqueued."""

    task_id: str
    status: str = "pending"


class InsightResultResponse(BaseModel):
    """GET /api/v1/insights/{task_id} — polling response."""

    task_id: str
    status: str  # "pending" | "complete"
    result: dict[str, Any] | None = None


class LatestInsightResponse(BaseModel):
    """GET /api/v1/insights/latest — newest persisted monthly insight."""

    model_config = ConfigDict(from_attributes=True)

    period_start: date
    period_end: date
    advice: str
    summary: dict[str, Any]
    model_used: str
    created_at: datetime
