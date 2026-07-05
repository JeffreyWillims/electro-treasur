"""
arq Worker — LLM Insight Generator.

Architecture:
  • Pure asyncio — runs inside the arq worker event loop.
  • CPU-bound work (e.g. real LLM inference) is offloaded via
    `run_in_executor(ProcessPoolExecutor)` to avoid blocking the loop.
  • Results are persisted to Redis with TTL=24h under key
    `insight:{user_id}:{year}`.

Usage:
    arq src.infrastructure.workers.llm_worker.WorkerSettings
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import date, datetime
from typing import Any

from arq import cron
from arq.connections import ArqRedis, RedisSettings, create_pool
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.config import settings
from src.infrastructure.workers.insight_worker import calculate_static_insights
from src.services.cashflow_prep import (
    build_insight_prompt,
    get_active_user_ids,
    previous_month_range,
    upsert_insight,
)

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты финансовый советник. Проанализируй период с {start_date} по {end_date}. "
    "Поступления: {income}, Списания: {expense}. "
    "Дай 3 коротких совета по оптимизации бюджета в стиле Apple/Fintech (без воды, строго по делу)."
)


async def _cpu_bound_llm_simulation(
    start_date: str, end_date: str, income: float, expense: float
) -> dict[str, Any]:
    """
    Simulates LLM processing (CPU-heavy) for the financial mentor.
    """
    await asyncio.sleep(3)  # Heavy thinking

    insight_text = (
        f"Анализ периода {start_date} — {end_date}. "
        "1. Диверсифицируйте поступления: ваши доходы стабильны, но инфляция требует роста капитала. "
        "2. Оптимизируйте категории с высоким оттоком: снизьте расходы на 15%, чтобы создать буфер ликвидности. "
        "3. Переместите свободные средства на депозит с дневной капитализацией (статус Premium: 18%)."
    )

    savings = income - expense
    savings_rate = (savings / income * 100) if income > 0 else 0

    return {
        "generated_at": datetime.now().isoformat(),
        "insight": insight_text,
        "summary": {
            "total_income": str(income),
            "total_expense": str(expense),
            "savings_rate": f"{savings_rate:.1f}%",
            "top_expense_category": "Анализ...",
            "top_growth_category": "Анализ...",
        },
    }


async def generate_annual_llm_insight(
    ctx: dict[str, Any], user_id: int, start_date_str: str, end_date_str: str
) -> dict[str, Any]:
    """
    arq task: generate financial insight via mock LLM for date range.
    """
    logger.info(
        "Generating LLM insight for user=%d %s to %s",
        user_id,
        start_date_str,
        end_date_str,
    )

    SessionLocal = ctx["SessionLocal"]
    from src.services.dashboard_service import get_monthly_dashboard

    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

    async with SessionLocal() as session:
        dashboard = await get_monthly_dashboard(session, user_id, start_date, end_date)
        period_income = float(dashboard.period_income)
        period_expense = float(dashboard.period_expense)

    result = await _cpu_bound_llm_simulation(
        start_date_str, end_date_str, period_income, period_expense
    )

    # Persist to Redis with 24h TTL
    redis = ctx.get("redis")
    if redis is not None:
        cache_key = f"insight:{user_id}:{start_date_str}:{end_date_str}"
        await redis.set(
            cache_key,
            json.dumps(result, ensure_ascii=False),
            ex=settings.redis_insight_ttl,
        )
        logger.info("Cached insight at key=%s TTL=%ds", cache_key, settings.redis_insight_ttl)

    return result


async def generate_llm_insight(
    ctx: dict[str, Any], user_id: int, start_date_str: str, end_date_str: str
) -> dict[str, Any]:
    """
    arq fan-out task: monthly insight for ONE user, persisted to PostgreSQL.

    Fetches the user's transactions for the period, builds the prompt in
    memory, runs the (mock) LLM, and upserts the result into `insights`.
    One failing user cannot affect the others — each runs as its own job.
    """
    from src.services.dashboard_service import get_monthly_dashboard

    start_date = date.fromisoformat(start_date_str)
    end_date = date.fromisoformat(end_date_str)

    SessionLocal = ctx["SessionLocal"]
    async with SessionLocal() as session:
        dashboard = await get_monthly_dashboard(session, user_id, start_date, end_date)
        income = float(dashboard.period_income)
        expense = float(dashboard.period_expense)

        # Prompt built in memory — the real LLM (Ollama/Qwen) plugs in here later.
        prompt = build_insight_prompt(start_date, end_date, income, expense)
        logger.debug("insight prompt user=%d: %s", user_id, prompt)

        result = await _cpu_bound_llm_simulation(start_date_str, end_date_str, income, expense)

        await upsert_insight(
            session,
            user_id=user_id,
            period_start=start_date,
            period_end=end_date,
            advice=result["insight"],
            summary=result["summary"],
            model_used="mock",
        )
        await session.commit()

    logger.info("Persisted insight user=%d %s..%s", user_id, start_date_str, end_date_str)
    return {"user_id": user_id, "period": [start_date_str, end_date_str], "model_used": "mock"}


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
        await pool.enqueue_job(
            "calculate_static_insights",
            user_id,
            start_date.isoformat(),
            end_date.isoformat(),
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
    """arq worker startup hook — initialize Redis connection."""
    from redis.asyncio import Redis

    ctx["redis"] = Redis.from_url(settings.redis_url, decode_responses=True)
    # Dedicated arq pool so cron fan-out can enqueue jobs (ctx["redis"] above is
    # the plain cache client, not an ArqRedis).
    ctx["arq_pool"] = await create_pool(RedisSettings.from_dsn(settings.arq_redis_url))
    engine = create_async_engine(settings.database_url)
    ctx["SessionLocal"] = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    logger.info("arq worker started, Redis & DB connected.")


async def shutdown(ctx: dict[str, Any]) -> None:
    """arq worker shutdown hook — close Redis connections."""
    redis = ctx.get("redis")
    if redis:
        await redis.aclose()
    pool = ctx.get("arq_pool")
    if pool:
        await pool.aclose()
    logger.info("arq worker shut down.")


class WorkerSettings:
    """arq worker configuration — importable as module path."""

    functions = [generate_annual_llm_insight, generate_llm_insight, calculate_static_insights]
    cron_jobs = [cron(schedule_monthly_analysis, day=1, hour=3, minute=0)]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.arq_redis_url)
    max_jobs = 10
    job_timeout = 60  # seconds
