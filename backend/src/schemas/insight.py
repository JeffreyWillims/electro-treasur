"""
Pydantic V2 schemas for LLM Insight endpoints.
"""
from __future__ import annotations

from pydantic import BaseModel, Field


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
    result: dict | None = None
