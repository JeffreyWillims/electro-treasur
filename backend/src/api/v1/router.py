from __future__ import annotations

from fastapi import APIRouter

from src.api.v1.analytics import router as analytics_router
from src.api.v1.auth import router as auth_router
from src.api.v1.budgets import router as budgets_router
from src.api.v1.dashboard import router as dashboard_router
from src.api.v1.feedback import router as feedback_router
from src.api.v1.insights import router as insights_router
from src.api.v1.offers import router as offers_router
from src.api.v1.transactions import router as transactions_router
from src.api.v1.users import router as users_router

router = APIRouter(prefix="/v1")


@router.get("/health", tags=["System"], summary="Load Balancer Healthcheck")
async def healthcheck() -> dict[str, str]:
    """O(1) ping endpoint for Nginx/Kubernetes liveness probes."""
    return {"status": "ok"}


router.include_router(auth_router, prefix="/auth")
router.include_router(users_router, prefix="/users")
router.include_router(dashboard_router, prefix="/dashboard")
router.include_router(transactions_router, prefix="/transactions")
router.include_router(analytics_router, prefix="/analytics")
router.include_router(budgets_router, prefix="/budgets")
router.include_router(insights_router, prefix="/insights")
router.include_router(offers_router, prefix="/offers")
router.include_router(feedback_router, prefix="/feedback")
