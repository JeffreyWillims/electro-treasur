"""
Уведомления колокольчика — только полезное: «Что нового» в проекте и итоги
фоновых воркеров (например, готовность месячного отчёта). Рекорды игр в ленту
не пишутся, а старые записи type="record" отфильтровываются из выдачи.

GET  /          — лента (лениво досеивает записи «Что нового») + счётчик непрочитанного.
POST /read-all  — пометить все уведомления пользователя прочитанными.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import Notification, User
from src.schemas.notification import NotificationList, NotificationOut

router = APIRouter(tags=["Notifications"])

FEED_LIMIT = 50

# «Что нового» — обновления проекта. Ключ стабилен: каждая запись досеивается
# пользователю ровно один раз (ON CONFLICT DO NOTHING по (user_id, dedup_key)).
CHANGELOG: list[tuple[str, str, str]] = [
    (
        "upd:2026-07-coincatch",
        "Копилка, советник и переезды",
        "Вместо змейки — «Копилка»: лови монеты, уклоняйся от импульсивных трат. "
        "«Стоит ли покупать?» переехал в Аналитику, «Мои цели» — в Бюджеты.",
    ),
    (
        "upd:2026-07-arcade",
        "Большое обновление аркады",
        "«Десятка» — новый случайный расклад каждой партии. «Купюра 512 ₽» — настоящее "
        "скольжение плиток. «Золотая змейка» — пауза, мобильный D-pad и виброотклик.",
    ),
    (
        "upd:2026-07-piggy",
        "Сейф и дисциплина бюджета",
        "Во вкладке «Бюджеты» появились индекс дисциплины со званиями и «Сейф»: "
        "сэкономленное за месяц можно одной кнопкой отложить в цель.",
    ),
    (
        "upd:2026-07-health",
        "Финансовое здоровье 2.0",
        "Блок здоровья ожил: анимированное кольцо с подсветкой, набегающий счётчик "
        "балла и факторные бары.",
    ),
    (
        "upd:2026-07-total",
        "Общий зачёт в играх",
        "Рейтинг игроков теперь суммирует очки всех трёх игр — общий зачёт "
        "открывается по умолчанию.",
    ),
]


@router.get("/", response_model=NotificationList)
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationList:
    # Досеиваем «Что нового» ОДНИМ батч-upsert вместо отдельного INSERT на каждую
    # запись при КАЖДОМ открытии колокольчика: раньше это были 5 round-trip'ов и
    # лишний WAL-churn на любой опрос. ON CONFLICT DO NOTHING оставляет уже
    # досеянные записи нетронутыми, поэтому в устоявшемся состоянии вставок нет.
    stmt = pg_insert(Notification).values(
        [
            {
                "user_id": current_user.id,
                "type": "update",
                "title": title,
                "body": body,
                "dedup_key": key,
            }
            for key, title, body in CHANGELOG
        ]
    )
    await db.execute(stmt.on_conflict_do_nothing(constraint="uq_notifications_user_dedup"))
    await db.commit()

    rows = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id, Notification.type != "record")
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(FEED_LIMIT)
    )
    items = [NotificationOut.model_validate(n) for n in rows.scalars().all()]
    unread = (
        await db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_id == current_user.id,
                Notification.type != "record",
                Notification.is_read.is_(False),
            )
        )
        or 0
    )
    return NotificationList(items=items, unread=unread)


@router.post("/read-all", status_code=200)
async def read_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}
