"""Integration: statement import API (upload enqueue, poll ownership, confirm)."""

from __future__ import annotations

from unittest.mock import AsyncMock

from httpx import AsyncClient
from pytest import MonkeyPatch
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Transaction, User


async def test_upload_enqueues_parse_job(
    async_client: AsyncClient, auth_headers: dict[str, str], monkeypatch: MonkeyPatch
) -> None:
    fake_pool = AsyncMock()

    async def _fake_pool() -> AsyncMock:
        return fake_pool

    monkeypatch.setattr("src.api.v1.imports._get_arq_pool", _fake_pool)

    resp = await async_client.post(
        "/v1/imports/statement",
        files={"file": ("s.pdf", b"%PDF-fake", "application/pdf")},
        headers=auth_headers,
    )
    assert resp.status_code == 202
    assert resp.json()["task_id"]
    fake_pool.enqueue_job.assert_awaited_once()
    args = fake_pool.enqueue_job.await_args.args
    assert args[0] == "parse_statement"
    assert isinstance(args[1], int)  # user_id
    assert args[3] == "s.pdf"  # file_name


async def test_upload_rejects_unsupported_ext(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    resp = await async_client.post(
        "/v1/imports/statement",
        files={"file": ("virus.exe", b"MZ", "application/octet-stream")},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_poll_unknown_task_404(
    async_client: AsyncClient, auth_headers: dict[str, str], monkeypatch: MonkeyPatch
) -> None:
    monkeypatch.setattr("src.api.v1.imports._get_arq_pool", AsyncMock())
    # Job.info() returns None for an unknown id → 404.
    resp = await async_client.get("/v1/imports/does-not-exist", headers=auth_headers)
    assert resp.status_code == 404


async def test_confirm_imports_and_dedupes(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    payload = {
        "items": [
            {"amount": "1500.00", "type": "expense", "description": "Пятёрочка",
             "category": "Operations (Rent/Utility)"},
            {"amount": "90000.00", "type": "income", "description": "Зарплата",
             "category": "Propulsion (Income)"},
        ]
    }
    resp = await async_client.post("/v1/imports/confirm", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["created"] == 2

    count = await db_session.scalar(
        select(func.count()).select_from(Transaction).where(Transaction.user_id == test_user.id)
    )
    assert count == 2

    # Idempotent re-confirm: same rows → all skipped, no duplicates.
    resp2 = await async_client.post("/v1/imports/confirm", json=payload, headers=auth_headers)
    body2 = resp2.json()
    assert body2["created"] == 0
    assert body2["skipped"] == 2
    count2 = await db_session.scalar(
        select(func.count()).select_from(Transaction).where(Transaction.user_id == test_user.id)
    )
    assert count2 == 2
