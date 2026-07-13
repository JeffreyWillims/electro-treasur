"""
tests/integration/test_games.py — рекорды Citrine Arcade и рейтинг.

Проверяет:
  • POST /v1/games/score с auth → 200, рекорд персистится;
  • повторный submit с меньшим счётом НЕ понижает рекорд (upsert best-only);
  • повторный submit с большим счётом обновляет рекорд;
  • GET /v1/games/leaderboard возвращает топ по убыванию очков;
  • оба эндпоинта требуют auth;
  • неизвестная игра → 422.
"""

from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import GameScore, User


async def _submit(client: AsyncClient, headers: dict[str, str], game: str, score: int) -> int:
    resp = await client.post(
        "/v1/games/score", json={"game": game, "score": score}, headers=headers
    )
    return resp.status_code


async def test_submit_score_persists(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    assert await _submit(async_client, auth_headers, "match", 150) == 200

    row = await db_session.scalar(select(GameScore).where(GameScore.user_id == test_user.id))
    assert row is not None
    assert row.game == "match"
    assert row.score == 150


async def test_submit_keeps_best_score(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    await _submit(async_client, auth_headers, "piggy", 500)
    await _submit(async_client, auth_headers, "piggy", 100)  # хуже — игнор

    row = await db_session.scalar(select(GameScore).where(GameScore.user_id == test_user.id))
    assert row is not None and row.score == 500

    await _submit(async_client, auth_headers, "piggy", 900)  # лучше — обновление
    await db_session.refresh(row)
    assert row.score == 900


async def test_leaderboard_sorted_desc(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
) -> None:
    await _submit(async_client, auth_headers, "game512", 512)

    resp = await async_client.get("/v1/games/leaderboard?game=game512", headers=auth_headers)
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) >= 1
    scores = [e["score"] for e in entries]
    assert scores == sorted(scores, reverse=True)
    assert all(e["name"] for e in entries)


async def test_games_require_auth(async_client: AsyncClient) -> None:
    assert (
        await async_client.post("/v1/games/score", json={"game": "match", "score": 1})
    ).status_code == 401
    assert (await async_client.get("/v1/games/leaderboard?game=match")).status_code == 401


async def test_unknown_game_rejected(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    assert await _submit(async_client, auth_headers, "doom", 9000) == 422
