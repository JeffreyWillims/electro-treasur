"""
tests/unit/test_telegram_helpers.py — Telegram Handler Pure Function Tests.

Tests all helper functions from handlers.py that have ZERO dependency
on Aiogram Bot, AsyncSession, or any I/O. Pure string/date manipulation.
"""

from __future__ import annotations

from datetime import date

import pytest

from src.infrastructure.telegram.handlers import (
    CATEGORY_SYNONYMS,
    CATEGORY_TRANSLATIONS,
    _attr,
    _clean_cat_name,
    _display_cat,
    _fix_layout,
    _get_current_month_range,
    _get_ru_month,
    _loc_category,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _get_ru_month
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestGetRuMonth:
    """Russian month name from date object."""

    @pytest.mark.parametrize(
        ("month", "expected"),
        [
            (1, "Январь 2026"),
            (2, "Февраль 2026"),
            (3, "Март 2026"),
            (6, "Июнь 2026"),
            (7, "Июль 2026"),
            (12, "Декабрь 2026"),
        ],
    )
    def test_month_names(self, month: int, expected: str) -> None:
        assert _get_ru_month(date(2026, month, 15)) == expected

    def test_january_first_day(self) -> None:
        assert _get_ru_month(date(2026, 1, 1)) == "Январь 2026"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _clean_cat_name
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCleanCatName:
    """Remove HEX color codes from category names."""

    def test_removes_hex_6(self) -> None:
        assert _clean_cat_name("#8B5CF6 стики") == "стики"

    def test_removes_hex_3(self) -> None:
        assert _clean_cat_name("#F00 красный") == "красный"

    def test_preserves_clean_name(self) -> None:
        assert _clean_cat_name("Продукты") == "Продукты"

    def test_empty_string(self) -> None:
        assert _clean_cat_name("") == ""

    def test_hex_only(self) -> None:
        assert _clean_cat_name("#AABBCC") == ""

    def test_multiple_hex_codes(self) -> None:
        """Should remove all HEX codes."""
        result = _clean_cat_name("#FF0000 #00FF00 текст")
        assert "текст" in result
        assert "#" not in result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _fix_layout
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestFixLayout:
    """English → Russian keyboard layout conversion."""

    def test_products(self) -> None:
        """'ghjlerns' typed in EN layout should become 'продукты'."""
        assert _fix_layout("ghjlerns") == "продукты"

    def test_coffee(self) -> None:
        """'rjat' typed in EN layout should become 'кофе'."""
        assert _fix_layout("rjat") == "кофе"

    def test_empty_string(self) -> None:
        assert _fix_layout("") == ""

    def test_cyrillic_passthrough(self) -> None:
        """Already-cyrillic text should pass through unchanged."""
        assert _fix_layout("продукты") == "продукты"

    def test_digits_preserved(self) -> None:
        """Digits should not be affected by layout conversion."""
        result = _fix_layout("500")
        assert result == "500"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _loc_category / _display_cat
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestLocCategory:
    """Localize system category names EN → RU."""

    def test_exact_match(self) -> None:
        assert _loc_category("Operations (Rent/Utility)") == "🏠 Базовые расходы (ЖКХ/Аренда)"

    def test_income(self) -> None:
        assert _loc_category("Income") == "💰 Доход"

    def test_unknown_passthrough(self) -> None:
        """Unknown category should pass through cleaned."""
        assert _loc_category("Custom Category") == "Custom Category"

    def test_with_hex_prefix(self) -> None:
        """HEX-prefixed system categories should match after cleaning."""
        result = _loc_category("#FF7A00 Leisure (Lifestyle)")
        assert "Лайфстайл" in result


class TestDisplayCat:
    """Full display formatting with emoji injection."""

    def test_system_category_translated(self) -> None:
        result = _display_cat("Propulsion (Income)")
        assert "🚀" in result

    def test_custom_russian_category_with_keyword(self) -> None:
        result = _display_cat("Базовые расходы")
        assert "🏠" in result

    def test_custom_health_category(self) -> None:
        result = _display_cat("Здоровье детей")
        assert "❤️" in result

    def test_unknown_gets_folder_emoji(self) -> None:
        """Unknown custom category should get 📁."""
        result = _display_cat("Случайная категория")
        assert "📁" in result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _get_current_month_range
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestGetCurrentMonthRange:
    """Month range utility."""

    def test_returns_tuple_of_dates(self) -> None:
        start, end = _get_current_month_range()
        assert isinstance(start, date)
        assert isinstance(end, date)

    def test_start_is_first_day(self) -> None:
        start, _ = _get_current_month_range()
        assert start.day == 1

    def test_end_is_last_day(self) -> None:
        _, end = _get_current_month_range()
        today = date.today()
        import calendar

        last_day = calendar.monthrange(today.year, today.month)[1]
        assert end.day == last_day

    def test_same_month_and_year(self) -> None:
        start, end = _get_current_month_range()
        assert start.month == end.month
        assert start.year == end.year


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# _attr
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestAttr:
    """Universal attribute getter for objects and dicts."""

    def test_from_object(self) -> None:
        class Obj:
            x = 42

        assert _attr(Obj(), "x") == 42

    def test_from_dict(self) -> None:
        assert _attr({"amount": 100}, "amount") == 100

    def test_dict_missing_key_returns_default(self) -> None:
        assert _attr({"a": 1}, "b", 99) == 99

    def test_object_missing_attr_returns_default(self) -> None:
        class Obj:
            pass

        assert _attr(Obj(), "missing", -1) == -1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CATEGORY_SYNONYMS dict consistency
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCategorySynonyms:
    """Data consistency for synonym → category mapping."""

    def test_all_synonyms_map_to_known_categories(self) -> None:
        """Every synonym value should exist in CATEGORY_TRANSLATIONS."""
        for word, sys_cat in CATEGORY_SYNONYMS.items():
            assert sys_cat in CATEGORY_TRANSLATIONS, (
                f"Synonym '{word}' → '{sys_cat}' not in CATEGORY_TRANSLATIONS"
            )

    def test_synonyms_are_lowercase(self) -> None:
        """All synonym keys should be lowercase for consistent matching."""
        for word in CATEGORY_SYNONYMS:
            assert word == word.lower(), f"Synonym key '{word}' is not lowercase"

    def test_income_synonyms_map_to_income_category(self) -> None:
        """Income-related words should map to 'Propulsion (Income)'."""
        income_words = {"зарплата", "аванс", "премия", "доход"}
        for word in income_words:
            assert CATEGORY_SYNONYMS[word] == "Propulsion (Income)"
