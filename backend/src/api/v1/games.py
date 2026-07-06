"""
Citrine Arcade endpoints — рекорды игр и рейтинг (топ-100).

POST /score       — upsert лучшего результата (обновляется только если выше).
GET  /leaderboard — топ-100 игроков по игре, имя = full_name или префикс email.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import GameScore, User
from src.schemas.games import GameKey, GameScoreSubmit, LeaderboardEntry

router = APIRouter(tags=["Games"])

LEADERBOARD_LIMIT = 100


@router.post("/score", status_code=200)
async def submit_score(
    payload: GameScoreSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    stmt = pg_insert(GameScore).values(
        user_id=current_user.id, game=payload.game, score=payload.score
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_game_scores_user_game",
        set_={"score": stmt.excluded.score, "updated_at": stmt.excluded.updated_at},
        where=stmt.excluded.score > GameScore.score,
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "ok"}


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def leaderboard(
    game: GameKey,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaderboardEntry]:
    rows = await db.execute(
        select(GameScore.score, User.full_name, User.email)
        .join(User, User.id == GameScore.user_id)
        .where(GameScore.game == game)
        .order_by(GameScore.score.desc(), GameScore.updated_at.asc())
        .limit(LEADERBOARD_LIMIT)
    )
    return [
        LeaderboardEntry(name=full_name or email.split("@")[0], score=score)
        for score, full_name, email in rows.all()
    ]
