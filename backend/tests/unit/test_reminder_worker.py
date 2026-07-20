"""
tests/unit/test_reminder_worker.py — proactive reminder cron entrypoints.

No DB: the cashflow_prep helpers and the Telegram notifier are mocked, so the
tests cover only the loop/counter/formatting logic of the two arq tasks.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, patch

from src.infrastructure.workers import reminder_worker


class _FakeSessionCtx:
    """Minimal async-context manager yielding a throwaway session object."""

    async def __aenter__(self) -> object:
        return object()

    async def __aexit__(self, *exc: object) -> bool:
        return False


def _ctx() -> dict[str, Any]:
    return {"SessionLocal": lambda: _FakeSessionCtx()}


async def test_remind_inactive_users_counts_successful_sends() -> None:
    targets = [(1, 111), (2, 222), (3, 333)]
    with (
        patch.object(
            reminder_worker, "get_linked_users_without_tx_on", AsyncMock(return_value=targets)
        ),
        patch.object(
            reminder_worker.notifier, "send_message", AsyncMock(side_effect=[True, False, True])
        ) as send,
    ):
        result = await reminder_worker.remind_inactive_users(_ctx())

    assert result["reminded"] == 2  # only the two successful deliveries
    assert send.await_count == 3
    assert result["day"] == date.today().isoformat()


async def test_remind_inactive_users_no_targets() -> None:
    with (
        patch.object(
            reminder_worker, "get_linked_users_without_tx_on", AsyncMock(return_value=[])
        ),
        patch.object(reminder_worker.notifier, "send_message", AsyncMock()) as send,
    ):
        result = await reminder_worker.remind_inactive_users(_ctx())

    assert result["reminded"] == 0
    send.assert_not_awaited()


async def test_push_free_funds_sends_only_to_users_with_chat() -> None:
    """Пользователи без chat_id отсекаются одним запросом-выборкой, а не в цикле.

    Регрессия на N+1: раньше рассылка делала SELECT chat_id на каждого активного
    пользователя; теперь адресаты приходят готовой парой (user_id, chat_id).
    """

    class _Session:
        async def __aenter__(self) -> _Session:
            return self

        async def __aexit__(self, *exc: object) -> bool:
            return False

    funds = {
        "income": Decimal("10000"),
        "expense": Decimal("3500"),
        "free": Decimal("6500"),
        "envelopes": [{"name": "Еда", "remaining": Decimal("1500")}],
    }
    with (
        # Вернулся только юзер 1: юзер 2 без chat_id отфильтрован в SQL.
        patch.object(
            reminder_worker, "get_active_users_with_chat", AsyncMock(return_value=[(1, 111)])
        ) as targets,
        patch.object(reminder_worker, "get_free_funds", AsyncMock(return_value=funds)) as ff,
        patch.object(
            reminder_worker.notifier, "send_message", AsyncMock(return_value=True)
        ) as send,
    ):
        ctx = {"SessionLocal": lambda: _Session()}
        result = await reminder_worker.push_free_funds(ctx)

    assert result["pushed"] == 1
    targets.assert_awaited_once()
    ff.assert_awaited_once()
    send.assert_awaited_once()
    assert send.await_args.args[0] == 111  # ушло на chat_id из выборки
    text = send.await_args.args[1]
    assert "Свободно в этом месяце" in text
    assert "Еда" in text


async def test_push_free_funds_no_targets_sends_nothing() -> None:
    """Никого с чатом — ни одного обращения к деньгам и ни одной отправки."""

    class _Session:
        async def __aenter__(self) -> _Session:
            return self

        async def __aexit__(self, *exc: object) -> bool:
            return False

    with (
        patch.object(reminder_worker, "get_active_users_with_chat", AsyncMock(return_value=[])),
        patch.object(reminder_worker, "get_free_funds", AsyncMock()) as ff,
        patch.object(reminder_worker.notifier, "send_message", AsyncMock()) as send,
    ):
        result = await reminder_worker.push_free_funds({"SessionLocal": lambda: _Session()})

    assert result["pushed"] == 0
    ff.assert_not_awaited()
    send.assert_not_awaited()
