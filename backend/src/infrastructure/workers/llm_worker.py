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
from datetime import datetime

from arq.connections import RedisSettings
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from src.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты финансовый советник. Проанализируй период с {start_date} по {end_date}. "
    "Поступления: {income}, Списания: {expense}. Дай 3 коротких совета по оптимизации бюджета в стиле Apple/Fintech (без воды, строго по делу)."
)


async def _cpu_bound_llm_simulation(
    start_date: str, end_date: str, income: float, expense: float
) -> dict:
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
    ctx: dict, user_id: int, start_date_str: str, end_date_str: str
) -> dict:
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
        logger.info(
            "Cached insight at key=%s TTL=%ds", cache_key, settings.redis_insight_ttl
        )

    return result


async def startup(ctx: dict) -> None:
    """arq worker startup hook — initialize Redis connection."""
    from redis.asyncio import Redis

    ctx["redis"] = Redis.from_url(settings.redis_url, decode_responses=True)
    engine = create_async_engine(settings.database_url)
    ctx["SessionLocal"] = async_sessionmaker(
        bind=engine, autoflush=False, expire_on_commit=False
    )
    logger.info("arq worker started, Redis & DB connected.")


async def shutdown(ctx: dict) -> None:
    """arq worker shutdown hook — close Redis connection."""
    redis = ctx.get("redis")
    if redis:
        await redis.aclose()
    logger.info("arq worker shut down.")


class WorkerSettings:
    """arq worker configuration — importable as module path."""

    functions = [generate_annual_llm_insight]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.arq_redis_url)
    max_jobs = 10
    job_timeout = 60  # seconds
