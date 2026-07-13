"""
Citrine Arcade endpoints — рекорды игр и рейтинг (топ-100).

POST /score             — upsert лучшего результата (обновляется только если выше).
GET  /leaderboard       — топ-100 игроков по игре, имя = full_name или префикс email.
GET  /leaderboard/total — общий зачёт: сумма лучших результатов по всем играм.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import GameScore, Notification, User
from src.schemas.games import GameKey, GameScoreSubmit, LeaderboardEntry

router = APIRouter(tags=["Games"])

LEADERBOARD_LIMIT = 100

GAME_TITLES: dict[str, str] = {
    "match": "Десятка",
    "game512": "Купюра 512 ₽",
    "piggy": "Копилка",
}


@router.post("/score", status_code=200)
async def submit_score(
    payload: GameScoreSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    prev = await db.scalar(
        select(GameScore.score).where(
            GameScore.user_id == current_user.id, GameScore.game == payload.game
        )
    )

    stmt = pg_insert(GameScore).values(
        user_id=current_user.id, game=payload.game, score=payload.score
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_game_scores_user_game",
        set_={"score": stmt.excluded.score, "updated_at": stmt.excluded.updated_at},
        where=stmt.excluded.score > GameScore.score,
    )
    await db.execute(stmt)

    # Новый личный рекорд → уведомление в колокольчик (идемпотентно по dedup_key).
    if prev is None or payload.score > prev:
        note = pg_insert(Notification).values(
            user_id=current_user.id,
            type="record",
            title=f"Новый рекорд — {GAME_TITLES[payload.game]}",
            body=f"Личный рекорд обновлён: {payload.score:,} очков.".replace(",", " "),
            dedup_key=f"record:{payload.game}:{payload.score}",
        )
        await db.execute(note.on_conflict_do_nothing(constraint="uq_notifications_user_dedup"))

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


@router.get("/leaderboard/total", response_model=list[LeaderboardEntry])
async def leaderboard_total(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LeaderboardEntry]:
    total = func.sum(GameScore.score).label("total")
    rows = await db.execute(
        select(total, User.full_name, User.email)
        .join(User, User.id == GameScore.user_id)
        # Рекорды снятых с полки игр (например, «Золотой змейки») не считаем.
        .where(GameScore.game.in_(GAME_TITLES))
        .group_by(User.id, User.full_name, User.email)
        .order_by(total.desc())
        .limit(LEADERBOARD_LIMIT)
    )
    return [
        LeaderboardEntry(name=full_name or email.split("@")[0], score=int(score))
        for score, full_name, email in rows.all()
    ]
