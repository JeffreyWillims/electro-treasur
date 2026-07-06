"""Pydantic V2 schemas for Citrine Arcade game scores."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

GameKey = Literal["match", "game512", "snake"]


class GameScoreSubmit(BaseModel):
    """POST /api/v1/games/score body."""

    game: GameKey
    score: int = Field(..., ge=1, le=100_000_000)


class LeaderboardEntry(BaseModel):
    """Одна строка рейтинга — имя игрока и его лучший результат."""

    name: str
    score: int
