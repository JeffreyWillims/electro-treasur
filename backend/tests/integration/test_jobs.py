"""Integration: SSE job status stream (ownership + complete event). arq is faked."""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient
from pytest import MonkeyPatch

from src.api.v1 import jobs as jobs_module
from src.domain.models import User

FAKE_TASK_ID = "00000000-0000-0000-0000-00000000abcd"


async def _fake_pool() -> None:
    return None


class _FakeResult:
    """Стоит на месте arq.jobs.JobResult: завершённая задача владельца owner_id."""

    def __init__(self, owner_id: int) -> None:
        self.args = (owner_id, "b64", "statement.pdf")
        self.success = True
        self.result: dict[str, Any] = {"candidates": [], "count": 0}


def _patch(monkeypatch: MonkeyPatch, owner_id: int) -> None:
    monkeypatch.setattr(jobs_module, "_get_arq_pool", _fake_pool)
    monkeypatch.setattr(jobs_module, "JobResult", _FakeResult)

    class _FakeJob:
        def __init__(self, job_id: str, redis: Any) -> None:
            pass

        async def info(self) -> _FakeResult:
            return _FakeResult(owner_id)

    monkeypatch.setattr(jobs_module, "Job", _FakeJob)


async def test_stream_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.get(f"/v1/jobs/{FAKE_TASK_ID}/stream")
    assert resp.status_code == 401


async def test_stream_completes_with_result(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    monkeypatch: MonkeyPatch,
) -> None:
    _patch(monkeypatch, owner_id=test_user.id)
    resp = await async_client.get(f"/v1/jobs/{FAKE_TASK_ID}/stream", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert '"status": "complete"' in resp.text


async def test_stream_foreign_task_errors(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    monkeypatch: MonkeyPatch,
) -> None:
    _patch(monkeypatch, owner_id=test_user.id + 1)  # чужая задача
    resp = await async_client.get(f"/v1/jobs/{FAKE_TASK_ID}/stream", headers=auth_headers)
    assert resp.status_code == 200
    assert '"status": "error"' in resp.text
