"""
tests/integration/test_feedback.py — Feedback endpoint + async email stub.

Проверяет:
  • POST /v1/feedback с auth → 200 {"status": "ok"} (мгновенный ответ);
  • сообщение персистится в БД (save_feedback через savepoint-сессию);
  • без auth-cookie → 401;
  • EmailService.send_feedback красиво логирует «письмо» (фоновая часть);
  • эндпоинт коммитит транзакцию — фидбек переживает закрытие сессии get_db.
"""

from __future__ import annotations

import logging
from unittest import mock

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Feedback, User
from src.services.email_service import EmailService
from src.services.feedback_service import save_feedback


async def test_submit_feedback_returns_ok(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    resp = await async_client.post(
        "/v1/feedback/", json={"message": "Отличное приложение!"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_submit_feedback_requires_auth(async_client: AsyncClient) -> None:
    resp = await async_client.post("/v1/feedback/", json={"message": "hi"})
    assert resp.status_code == 401


async def test_empty_message_rejected(
    async_client: AsyncClient, auth_headers: dict[str, str], test_user: User
) -> None:
    resp = await async_client.post("/v1/feedback/", json={"message": ""}, headers=auth_headers)
    assert resp.status_code == 422


async def test_save_feedback_persists_row(db_session: AsyncSession, test_user: User) -> None:
    await save_feedback(db_session, user_id=test_user.id, message="сохрани меня")
    await db_session.flush()

    row = await db_session.scalar(select(Feedback).where(Feedback.user_id == test_user.id))
    assert row is not None
    assert row.message == "сохрани меня"


async def test_submit_feedback_commits_transaction(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Регрессия: save_feedback делал только flush() без commit(), поэтому INSERT
    откатывался при закрытии реальной сессии get_db, хотя клиент уже получил "ok".
    Эндпоинт обязан зафиксировать транзакцию до/независимо от фоновой отправки письма.
    """
    with (
        mock.patch.object(db_session, "commit", wraps=db_session.commit) as commit_spy,
        mock.patch.object(EmailService, "send_feedback", new=mock.AsyncMock()),
    ):
        resp = await async_client.post(
            "/v1/feedback/",
            json={"message": "должно пережить закрытие сессии"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    commit_spy.assert_awaited()


async def test_email_service_logs_feedback(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="email"):
        await EmailService.send_feedback("user@example.com", "тестовое сообщение")
    assert "FEEDBACK EMAIL" in caplog.text
    assert "user@example.com" in caplog.text
    assert "тестовое сообщение" in caplog.text
