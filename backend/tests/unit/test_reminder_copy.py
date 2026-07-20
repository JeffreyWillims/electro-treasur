"""
tests/unit/test_reminder_copy.py — тексты напоминания «запиши траты за день».

Без БД и без сети: проверяется только чистый выбор формулировки —
тон по времени суток (cron шлёт в 10:00 и 19:00 UTC), чередование по дню
и то, что подсказка формата остаётся в каждом варианте.
"""

from __future__ import annotations

from datetime import UTC, datetime

from src.infrastructure.workers.reminder_worker import (
    DAY_REMINDERS,
    EVENING_REMINDERS,
    build_reminder_text,
)


def _at(month: int, day: int, hour: int) -> datetime:
    return datetime(2026, month, day, hour, 0, tzinfo=UTC)


def test_daytime_ping_uses_day_pool() -> None:
    """10:00 UTC (13:00 МСК) — дневной, лёгкий чек-ин."""
    assert build_reminder_text(_at(7, 20, 10)) in DAY_REMINDERS


def test_evening_ping_uses_evening_pool() -> None:
    """19:00 UTC (22:00 МСК) — вечерний, про итог дня."""
    assert build_reminder_text(_at(7, 20, 19)) in EVENING_REMINDERS


def test_same_day_and_hour_is_deterministic() -> None:
    """Один и тот же момент → один и тот же текст (без случайности)."""
    assert build_reminder_text(_at(7, 20, 10)) == build_reminder_text(_at(7, 20, 10))


def test_text_rotates_between_consecutive_days() -> None:
    """Соседние дни не должны присылать одну и ту же формулировку."""
    assert build_reminder_text(_at(7, 20, 10)) != build_reminder_text(_at(7, 21, 10))


def test_day_and_evening_texts_differ() -> None:
    """В один день дневной и вечерний пинги звучат по-разному."""
    assert build_reminder_text(_at(7, 20, 10)) != build_reminder_text(_at(7, 20, 19))


def test_every_variant_keeps_the_format_hint() -> None:
    """В каждом варианте есть пример ввода — иначе непонятно, что присылать."""
    for text in DAY_REMINDERS + EVENING_REMINDERS:
        assert "«" in text and "»" in text, text


def test_tone_has_no_guilt_words() -> None:
    """Тон поддерживающий: без «не забудь», «должен», «опять» и упрёков."""
    forbidden = ("не забудь", "должен", "обязан", "опять", "снова забыл")
    for text in DAY_REMINDERS + EVENING_REMINDERS:
        lowered = text.lower()
        for word in forbidden:
            assert word not in lowered, f"{word!r} в тексте: {text}"


def test_full_year_never_crashes_and_covers_all_variants() -> None:
    """За год выбираются все варианты и ни один день не падает по индексу."""
    seen_day: set[str] = set()
    seen_evening: set[str] = set()
    for day_of_year in range(1, 367):
        moment = datetime.fromordinal(datetime(2026, 1, 1).toordinal() + day_of_year - 1)
        seen_day.add(build_reminder_text(moment.replace(hour=10, tzinfo=UTC)))
        seen_evening.add(build_reminder_text(moment.replace(hour=19, tzinfo=UTC)))
    assert seen_day == set(DAY_REMINDERS)
    assert seen_evening == set(EVENING_REMINDERS)
