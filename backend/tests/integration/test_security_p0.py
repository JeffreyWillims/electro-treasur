"""
tests/integration/test_security_p0.py — P0: Broken Access Control на poll-эндпоинтах.

Уязвимость (docs/security_audit.md): GET /v1/insights/{task_id} и
GET /api/analytics/tasks/{task_id} не требовали JWT — любой, узнавший UUID задачи,
мог прочитать финансовый инсайт чужого пользователя.

Контракт после фикса:
  • без токена               → 401 (зависимость get_current_user);
  • чужая задача              → 404 (ownership: args[0] задачи == current_user.id);
  • своя задача, не завершена → 200 {"status": "pending"} (контракт поллинга сохранён).

arq/Redis в этих тестах не нужны: _get_arq_pool и Job подменяются фейками.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from httpx import AsyncClient

from src.api.analytics import yearly as yearly_module
from src.api.v1 import insights as insights_module
from src.domain.models import User

FAKE_TASK_ID = "00000000-0000-0000-0000-00000000abcd"


async def _fake_pool() -> None:
    """Подмена _get_arq_pool: Redis в тесте не поднимается."""
    return None


def _fake_job_class(owner_id: int) -> type:
    """Job-фейк: info() отдаёт задачу, принадлежащую owner_id (статус: в очереди)."""

    class _FakeJob:
        def __init__(self, job_id: str, redis: Any) -> None:
            self.job_id = job_id

        async def info(self) -> SimpleNamespace:
            return SimpleNamespace(args=(owner_id, "2026-06-01", "2026-06-30"))

    return _FakeJob


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Без JWT — 401 на оба эндпоинта
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestPollRequiresAuth:
    async def test_insights_poll_unauthenticated_401(self, async_client: AsyncClient) -> None:
        resp = await async_client.get(f"/v1/insights/{FAKE_TASK_ID}")
        assert resp.status_code == 401

    async def test_yearly_poll_unauthenticated_401(self, async_client: AsyncClient) -> None:
        resp = await async_client.get(f"/api/analytics/tasks/{FAKE_TASK_ID}")
        assert resp.status_code == 401


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Ownership: чужая задача → 404, своя → прежний контракт поллинга
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestPollOwnership:
    async def test_insights_foreign_task_404(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(insights_module, "_get_arq_pool", _fake_pool)
        monkeypatch.setattr(insights_module, "Job", _fake_job_class(owner_id=test_user.id + 1))

        resp = await async_client.get(f"/v1/insights/{FAKE_TASK_ID}", headers=auth_headers)
        assert resp.status_code == 404

    async def test_insights_own_pending_task_200(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(insights_module, "_get_arq_pool", _fake_pool)
        monkeypatch.setattr(insights_module, "Job", _fake_job_class(owner_id=test_user.id))

        resp = await async_client.get(f"/v1/insights/{FAKE_TASK_ID}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

    async def test_yearly_foreign_task_404(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        test_user: User,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(yearly_module, "_get_arq_pool", _fake_pool)
        monkeypatch.setattr(yearly_module, "Job", _fake_job_class(owner_id=test_user.id + 1))

        resp = await async_client.get(f"/api/analytics/tasks/{FAKE_TASK_ID}", headers=auth_headers)
        assert resp.status_code == 404
