"""
arq Worker — Insight tasks (детерминированный RuleBasedInsightEngine, без LLM).

Задачи:
  • generate_period_insight — кнопка «AI Анализ» и годовой отчёт:
    мгновенный расчёт RuleBasedInsightEngine за произвольный период,
    результат возвращается через polling арк-джобы.
  • calculate_static_insights — предрасчёт с записью в `insights`
    (+ Telegram-пуш), см. insight_worker.py.

Cron: месячный фан-аут (1-е число) и еженедельный пуш (воскресенье).

Usage:
    arq src.infrastructure.workers.insight_scheduler.WorkerSettings
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from arq import cron
from arq.connections import ArqRedis, RedisSettings, create_pool
from sqlalchemy.ext.asyncio import async_sessionmaker

from src.config import settings
from src.database import engine as db_engine
from src.infrastructure.workers.import_worker import parse_statement
from src.infrastructure.workers.insight_worker import (
    build_insight_for_period,
    calculate_static_insights,
    schedule_weekly_push,
)
from src.infrastructure.workers.reminder_worker import (
    push_free_funds,
    remind_inactive_users,
)
from src.services.cashflow_prep import (
    get_active_user_ids,
    previous_month_range,
)

logger = logging.getLogger(__name__)


async def generate_period_insight(
    ctx: dict[str, Any], user_id: int, start_date_str: str, end_date_str: str
) -> dict[str, Any]:
    """
    arq task: инсайт за произвольный период для кнопки «AI Анализ».

    Детерминированный расчёт RuleBasedInsightEngine (микросекунды).
    Результат читается через polling джобы.
    """
    start_date = date.fromisoformat(start_date_str)
    end_date = date.fromisoformat(end_date_str)

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        advice, income, expense = await build_insight_for_period(
            session, user_id, start_date, end_date
        )

    savings_rate = (income - expense) / income * 100 if income > 0 else Decimal("0")
    result = {
        "generated_at": datetime.now(UTC).isoformat(),
        "insight": advice,
        "summary": {
            "total_income": str(income),
            "total_expense": str(expense),
            "savings_rate": f"{savings_rate:.1f}%",
        },
    }
    logger.info("Insight generated user=%d %s..%s", user_id, start_date_str, end_date_str)
    return result


async def schedule_monthly_analysis(ctx: dict[str, Any]) -> dict[str, Any]:
    """
    Cron entrypoint (1st of each month, 03:00): fan out one insight job per
    active user for the previous full month.
    """
    start_date, end_date = previous_month_range(date.today())

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        user_ids = await get_active_user_ids(session, start_date, end_date)

    pool: ArqRedis = ctx["arq_pool"]
    for user_id in user_ids:
        # Детерминированный _job_id делает фан-аут идемпотентным: повторный
        # запуск cron (рестарт воркера, вторая реплика) не поставит задачу
        # второй раз, иначе пользователь получил бы дубль пуша в Telegram.
        await pool.enqueue_job(
            "calculate_static_insights",
            user_id,
            start_date.isoformat(),
            end_date.isoformat(),
            _job_id=f"insight:{user_id}:{start_date.isoformat()}:{end_date.isoformat()}",
        )

    logger.info(
        "Scheduled %d insight jobs for %s..%s",
        len(user_ids),
        start_date.isoformat(),
        end_date.isoformat(),
    )
    return {
        "scheduled": len(user_ids),
        "period": [start_date.isoformat(), end_date.isoformat()],
    }


async def startup(ctx: dict[str, Any]) -> None:
    """arq worker startup hook — DB session factory + arq pool for cron fan-out."""
    ctx["arq_pool"] = await create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    # Переиспользуем общий engine из src.database: он единственный сконфигурирован
    # под PgBouncer (statement_cache_size=0, pool_pre_ping). Собственный
    # create_async_engine(database_url) без этих args ловил на проде плавающие
    # «prepared statement "__asyncpg_stmt__" does not exist» и утекал (не закрывался).
    ctx["SessionLocal"] = async_sessionmaker(
        bind=db_engine, autoflush=False, expire_on_commit=False
    )
    logger.info("arq worker started, DB connected.")


async def shutdown(ctx: dict[str, Any]) -> None:
    """arq worker shutdown hook — close arq pool and dispose the DB engine."""
    pool = ctx.get("arq_pool")
    if pool:
        await pool.aclose()
    await db_engine.dispose()
    logger.info("arq worker shut down.")


class WorkerSettings:
    """arq worker configuration — importable as module path."""

    functions = [
        generate_period_insight,
        calculate_static_insights,
        parse_statement,
        remind_inactive_users,
        push_free_funds,
    ]
    cron_jobs = [
        cron(schedule_monthly_analysis, day=1, hour=3, minute=0),
        # Воскресенье (weekday=6, как в datetime.weekday()), 18:00 UTC = 21:00 МСК.
        cron(schedule_weekly_push, weekday=6, hour=18, minute=0),
        # 10:00 и 19:00 UTC = 13:00 и 22:00 МСК.
        cron(remind_inactive_users, hour={10, 19}, minute=0),
        # Понедельник (weekday=0), 06:00 UTC = 09:00 МСК.
        cron(push_free_funds, weekday=0, hour=6, minute=0),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.arq_redis_url)
    max_jobs = 10
    job_timeout = 60  # seconds
