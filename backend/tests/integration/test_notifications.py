"""
tests/integration/test_notifications.py — колокольчик уведомлений.

Проверяет:
  • GET /v1/notifications лениво досеивает записи «Что нового» (идемпотентно);
  • POST /v1/notifications/read-all обнуляет счётчик непрочитанного;
  • новый рекорд в игре создаёт уведомление типа record (без дублей);
  • GET /v1/games/leaderboard/total суммирует очки всех игр;
  • эндпоинты требуют auth.
"""

from __future__ import annotations

from httpx import AsyncClient

from src.api.v1.notifications import CHANGELOG


async def test_changelog_seeded_once(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    first = (await async_client.get("/v1/notifications/", headers=auth_headers)).json()
    assert len(first["items"]) >= len(CHANGELOG)
    assert first["unread"] >= len(CHANGELOG)

    # Повторный запрос не плодит дубли «Что нового»
    second = (await async_client.get("/v1/notifications/", headers=auth_headers)).json()
    updates = [n for n in second["items"] if n["type"] == "update"]
    assert len(updates) == len(CHANGELOG)


async def test_read_all_resets_unread(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    await async_client.get("/v1/notifications/", headers=auth_headers)
    resp = await async_client.post("/v1/notifications/read-all", headers=auth_headers)
    assert resp.status_code == 200

    data = (await async_client.get("/v1/notifications/", headers=auth_headers)).json()
    assert data["unread"] == 0
    assert all(n["is_read"] for n in data["items"])


async def test_new_record_creates_notification(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    await async_client.post(
        "/v1/games/score", json={"game": "piggy", "score": 250}, headers=auth_headers
    )
    # Повторная отправка того же счёта не должна дублировать уведомление
    await async_client.post(
        "/v1/games/score", json={"game": "piggy", "score": 250}, headers=auth_headers
    )

    data = (await async_client.get("/v1/notifications/", headers=auth_headers)).json()
    records = [n for n in data["items"] if n["type"] == "record"]
    assert len(records) == 1
    assert "Копилка" in records[0]["title"]


async def test_total_leaderboard_sums_games(
    async_client: AsyncClient, auth_headers: dict[str, str]
) -> None:
    await async_client.post(
        "/v1/games/score", json={"game": "match", "score": 300}, headers=auth_headers
    )
    await async_client.post(
        "/v1/games/score", json={"game": "game512", "score": 700}, headers=auth_headers
    )

    resp = await async_client.get("/v1/games/leaderboard/total", headers=auth_headers)
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) >= 1
    scores = [e["score"] for e in entries]
    assert scores == sorted(scores, reverse=True)
    assert max(scores) >= 1000  # 300 + 700 у test_user

async def test_notifications_require_auth(async_client: AsyncClient) -> None:
    assert (await async_client.get("/v1/notifications/")).status_code == 401
    assert (await async_client.post("/v1/notifications/read-all")).status_code == 401
    assert (await async_client.get("/v1/games/leaderboard/total")).status_code == 401
