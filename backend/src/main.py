"""
Electro-Treasur — FastAPI Application Factory.

Startup/shutdown lifecycle hooks manage:
  • Async database engine
  • Redis connection pool
  • arq connection pool

OpenAPI schema is auto-generated — frontend can derive TypeScript types
via `openapi-typescript` CLI for Single Source of Truth DTO alignment.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import time
import json
from datetime import datetime
from fastapi import Request, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from src.api.v1.router import router as v1_router
from src.api.analytics.yearly import router as analytics_router
from src.infrastructure.redis_client import close_redis, get_redis
from src.database import get_session
from src.core.exceptions import setup_exception_handlers


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application lifecycle — startup and shutdown hooks."""
    # ── Startup ─────────────────────────────────────────────────────────
    yield
    # ── Shutdown ────────────────────────────────────────────────────────
    await close_redis()


app = FastAPI(
    title="Electro-Treasur API",
    version="0.1.0",
    description="HighLoad Financial Tracker — 100k CCU Orbital-Grade FinTech",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def json_log_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
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

# ── Routers ─────────────────────────────────────────────────────────────
app.include_router(v1_router)
app.include_router(analytics_router, prefix="/api")


@app.get("/health", tags=["System"])
async def health_check(
    db: AsyncSession = Depends(get_session), redis_client: Redis = Depends(get_redis)
) -> dict[str, str]:
    """Liveness probe resolving actual persistence layers."""
    try:
        await db.execute(text("SELECT 1"))
        await redis_client.ping()
        return {"status": "ok", "service": "electro-treasur"}
    except Exception:
        raise HTTPException(status_code=503, detail="Service Unavailable: Node Offline")
