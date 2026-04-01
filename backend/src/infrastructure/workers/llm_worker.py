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

from arq import cron
from arq.connections import RedisSettings

from src.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Ты — эксперт Финплана. Проанализируй цель пользователя (например, 'Ремонт кухни за 500к'). "
    "Посмотри, на сколько сокращение трат на определенные категории ускорит покупку. "
    "Выдай ответ в стиле: 'Если снизишь расходы на [Категория] на [X]%, накопишь на [Цель] на [Y] месяца быстрее. "
    "Рекомендую открыть счет в [Банк] под [Z]% годовых'. "
    "Используй актуальные ставки банков РФ (Альфа-Банк, Т-Банк, ВТБ: 16-20% для новых клиентов). "
    "Твой ответ должен быть в формате JSON: {'insight': 'текст совета', 'summary': {'total_income': 'сумма', 'total_expense': 'сумма', 'savings_rate': 'процент'}}."
)

async def _cpu_bound_llm_simulation(year: int) -> dict:
    """
    Simulates LLM processing (CPU-heavy) for the financial mentor.
    """
    await asyncio.sleep(3)  # Heavy thinking
    
    # Mock result calibration
    return {
        "generated_at": datetime.now().isoformat(),
        "insight": (
            "Привет! Отличный план — 'Ремонт на кухне'. Я проанализировал твои траты. "
            "Если снизишь расходы на Рестораны на 50%, накопишь на 300 000 ₽ на 3 месяца быстрее! "
            "Вы отлично справляетесь! Рекомендую открыть накопительный счет в Т-Банке или ВТБ под 17% годовых, "
            "чтобы капитализировать сэкономленные средства."
        ),
        "summary": {
            "total_income": "184_200",
            "total_expense": "100_000",
            "savings_rate": "45.0%",
            "top_expense_category": "Продукты",
            "top_growth_category": "Рестораны",
        }
    }


async def generate_annual_llm_insight(ctx: dict, user_id: int, year: int) -> dict:
    """
    arq task: generate a yearly financial insight via mock LLM.
    """
    logger.info("Generating LLM insight for user=%d year=%d", user_id, year)

    # Use pure async sleep to avoid multiprocess hangs on Windows
    result = await _cpu_bound_llm_simulation(year)

    # Persist to Redis with 24h TTL
    redis = ctx.get("redis")
    if redis is not None:
        cache_key = f"insight:{user_id}:{year}"
        await redis.set(cache_key, json.dumps(result, ensure_ascii=False), ex=settings.redis_insight_ttl)
        logger.info("Cached insight at key=%s TTL=%ds", cache_key, settings.redis_insight_ttl)

    return result


async def startup(ctx: dict) -> None:
    """arq worker startup hook — initialize Redis connection."""
    from redis.asyncio import Redis

    ctx["redis"] = Redis.from_url(settings.redis_url, decode_responses=True)
    logger.info("arq worker started, Redis connected.")


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
