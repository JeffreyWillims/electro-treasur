"""
Electro-Treasur — фабрика приложения FastAPI.

Хуки жизненного цикла startup/shutdown управляют:
  • асинхронным движком БД
  • пулом соединений Redis
  • пулом соединений arq

Схема OpenAPI генерируется автоматически — фронтенд может выводить TypeScript
типы через CLI `openapi-typescript` для согласования DTO по принципу Single
Source of Truth.
"""

from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, cast

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from redis.asyncio import Redis
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from src.admin import setup_admin
from src.api.analytics.yearly import router as analytics_router
from src.api.v1.router import router as v1_router
from src.api.v2.public import router as public_v2_router
from src.core.exceptions import setup_exception_handlers
from src.core.rate_limit import limiter
from src.database import get_session
from src.infrastructure.redis_client import close_redis, get_redis


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Управление жизненным циклом приложения — хуки startup и shutdown."""
    # ── Запуск ─────────────────────────────────────────────────────────
    yield
    # ── Остановка ────────────────────────────────────────────────────────
    await close_redis()


app = FastAPI(
    title="Electro-Treasur API",
    version="0.1.0",
    description="HighLoad Financial Tracker — 100k CCU Orbital-Grade FinTech",
    lifespan=lifespan,
)

# ── Proxy-заголовки ────────────────────────────────────────────────────────────
# Backend слушает :8000 только внутри docker-сети (наружу торчит лишь nginx на
# 80/443), поэтому доверяем X-Forwarded-For от любого пира: спуфить его извне
# нельзя. Без этого get_remote_address у rate-limiter'а видел бы IP nginx, а не
# клиента, и все клиенты попадали бы в одно ведро лимита.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# ── Ограничитель запросов (Rate Limiter) ─────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cast(Any, _rate_limit_exceeded_handler))

# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def json_log_middleware(request: Request, call_next: Callable[[Request], Any]) -> Response:
    start_time = time.perf_counter()
    status_code = 500
    try:
        response = cast(Response, await call_next(request))
        status_code = response.status_code
    except Exception:
        raise
    finally:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "method": request.method,
            "path": request.url.path,
            "status": status_code,
            "latency_ms": latency_ms,
            "user_id": "anonymous",
        }
        print(json.dumps(log_data), flush=True)
    return response


setup_exception_handlers(app)

# ── Роутеры ─────────────────────────────────────────────────────────────
app.include_router(v1_router)
app.include_router(public_v2_router)
# nginx проксирует /api/ → backend со срезанием префикса, поэтому монтируем без
# "/api" (роутер уже несёт prefix="/analytics"). Путь снаружи: /api/analytics/...
app.include_router(analytics_router)

# ── Админ-панель (SQLAdmin, монтируется в /admin) ──────────────────────
setup_admin(app)


@app.get("/health", tags=["System"])
async def health_check(
    db: AsyncSession = Depends(get_session), redis_client: Redis = Depends(get_redis)
) -> dict[str, str]:
    """Проверка живости, реально обращающаяся к слоям хранения данных."""
    try:
        await db.execute(text("SELECT 1"))
        await redis_client.ping()
        return {"status": "ok", "service": "electro-treasur"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Service Unavailable: Node Offline") from e
