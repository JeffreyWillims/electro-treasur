"""
tests/integration/test_feedback.py — отправка и чтение обратной связи.

Проверяет:
  • POST /v1/feedback с auth → 200 {"status": "ok"} (мгновенный ответ);
  • сообщение персистится в БД (save_feedback через savepoint-сессию);
  • без auth-cookie → 401, пустое сообщение → 422;
  • эндпоинт коммитит транзакцию — фидбек переживает закрытие сессии get_db;
  • GET /v1/feedback/ закрыт для обычных пользователей (403) и для всех,
    пока ET_FEEDBACK_ADMIN_EMAILS пуст;
  • владелец видит список с email автора и счётчиком непрочитанных;
  • PATCH .../read и .../read-all гасят счётчик.
"""

from __future__ import annotations

from unittest import mock

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.domain.models import Feedback, User
from src.services.feedback_service import save_feedback


@pytest.fixture
def as_owner(monkeypatch: pytest.MonkeyPatch, test_user: User) -> None:
    """Делает тестового пользователя владельцем окна обратной связи."""
    monkeypatch.setattr(settings, "feedback_admin_emails", test_user.email)


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
    assert row.is_read is False


async def test_submit_feedback_commits_transaction(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    db_session: AsyncSession,
) -> None:
    """Регрессия: save_feedback делал только flush() без commit(), поэтому INSERT
    откатывался при закрытии реальной сессии get_db, хотя клиент уже получил "ok".
    """
    with mock.patch.object(db_session, "commit", wraps=db_session.commit) as commit_spy:
        resp = await async_client.post(
            "/v1/feedback/",
            json={"message": "должно пережить закрытие сессии"},
            headers=auth_headers,
        )

    assert resp.status_code == 200
    commit_spy.assert_awaited()


async def test_read_feedback_requires_auth(async_client: AsyncClient) -> None:
    assert (await async_client.get("/v1/feedback/")).status_code == 401


async def test_read_feedback_forbidden_when_setting_empty(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Пустая настройка = окно закрыто для всех, включая обычного пользователя."""
    monkeypatch.setattr(settings, "feedback_admin_emails", "")
    resp = await async_client.get("/v1/feedback/", headers=auth_headers)
    assert resp.status_code == 403


async def test_read_feedback_forbidden_for_other_user(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Чужие обращения не видны: владелец — только тот, кто указан в настройке."""
    monkeypatch.setattr(settings, "feedback_admin_emails", "someone-else@example.com")
    resp = await async_client.get("/v1/feedback/", headers=auth_headers)
    assert resp.status_code == 403


async def test_owner_sees_items_with_author_and_unread_count(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    as_owner: None,
) -> None:
    await async_client.post(
        "/v1/feedback/", json={"message": "первое обращение"}, headers=auth_headers
    )

    resp = await async_client.get("/v1/feedback/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["unread"] >= 1
    assert any(item["message"] == "первое обращение" for item in body["items"])
    assert all(item["author_email"] for item in body["items"])


async def test_mark_one_read_decreases_unread(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    as_owner: None,
) -> None:
    await async_client.post("/v1/feedback/", json={"message": "погаси меня"}, headers=auth_headers)
    listed = (await async_client.get("/v1/feedback/", headers=auth_headers)).json()
    target = listed["items"][0]
    before = listed["unread"]

    resp = await async_client.patch(f"/v1/feedback/{target['id']}/read", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["updated"] == 1

    after = (await async_client.get("/v1/feedback/", headers=auth_headers)).json()
    assert after["unread"] == before - 1


async def test_mark_all_read_zeroes_counter(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    as_owner: None,
) -> None:
    await async_client.post("/v1/feedback/", json={"message": "раз"}, headers=auth_headers)
    await async_client.post("/v1/feedback/", json={"message": "два"}, headers=auth_headers)

    resp = await async_client.patch("/v1/feedback/read-all", headers=auth_headers)
    assert resp.status_code == 200

    after = (await async_client.get("/v1/feedback/", headers=auth_headers)).json()
    assert after["unread"] == 0


async def test_mark_read_forbidden_for_non_owner(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    test_user: User,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "feedback_admin_emails", "")
    assert (
        await async_client.patch("/v1/feedback/read-all", headers=auth_headers)
    ).status_code == 403
