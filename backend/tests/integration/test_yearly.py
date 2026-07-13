"""Integration test: yearly analytics enqueue passes a valid full-year date range.

Regression guard — the endpoint used to enqueue the job with `body.year` (int)
where the worker expects (user_id, start_date_str, end_date_str), which crashed
the task with a TypeError.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient
from pytest import MonkeyPatch


async def test_yearly_enqueues_full_date_range(
    async_client: AsyncClient, auth_headers: dict[str, str], monkeypatch: MonkeyPatch
) -> None:
    fake_pool = AsyncMock()

    async def _fake_pool() -> AsyncMock:
        return fake_pool

    monkeypatch.setattr("src.api.analytics.yearly._get_arq_pool", _fake_pool)

    resp = await async_client.post("/analytics/yearly", json={"year": 2026}, headers=auth_headers)
    assert resp.status_code == 202

    fake_pool.enqueue_job.assert_awaited_once()
    args = fake_pool.enqueue_job.await_args.args
    assert args[0] == "generate_period_insight"
    assert isinstance(args[1], int)  # user_id
    assert args[2] == "2026-01-01"  # start_date_str
    assert args[3] == "2026-12-31"  # end_date_str
