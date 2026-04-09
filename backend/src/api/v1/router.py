"""
API v1 Root Router — aggregates all v1 sub-routers.
"""

from __future__ import annotations

from fastapi import APIRouter

from src.api.v1.dashboard import router as dashboard_router
from src.api.v1.insights import router as insights_router
from src.api.v1.transactions import router as transactions_router
from src.api.v1.analytics import router as analytics_router
from src.api.v1.auth import router as auth_router
from src.api.v1.users import router as users_router

router = APIRouter(prefix="/api/v1")

router.include_router(auth_router)
router.include_router(users_router)
router.include_router(transactions_router)
router.include_router(dashboard_router)
router.include_router(insights_router)
router.include_router(analytics_router)
