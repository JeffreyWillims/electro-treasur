"""Pydantic V2 schema for user feedback."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    """POST /api/v1/feedback body."""

    message: str = Field(..., min_length=1, max_length=2000)
