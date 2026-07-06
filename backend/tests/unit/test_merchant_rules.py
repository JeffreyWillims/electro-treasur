"""Unit tests for merchant category resolution (built-in dict + DB overrides)."""

from __future__ import annotations

from src.services.ai_vision_service import (
    _parse_transactions_from_text,
    resolve_merchant_category,
)


def test_builtin_dictionary_matches() -> None:
    assert resolve_merchant_category("чек пятерочка москва") == ("Продукты", "пятерочка")


def test_no_match_returns_none() -> None:
    assert resolve_merchant_category("неизвестный магазин будущего") is None


def test_extra_rule_extends_builtin() -> None:
    extra = {"стимбот": "Развлечения"}
    assert resolve_merchant_category("покупка стимбот игры", extra) == (
        "Развлечения",
        "стимбот",
    )


def test_extra_rule_overrides_builtin_keyword() -> None:
    # Встроенный словарь: "кофе" → "Лайфстайл"; правило из БД переопределяет.
    extra = {"кофе": "Продукты"}
    assert resolve_merchant_category("утренний кофе", extra) == ("Продукты", "кофе")
    # Без переопределения — встроенное поведение.
    assert resolve_merchant_category("утренний кофе") == ("Лайфстайл", "кофе")


def test_parse_receipt_uses_extra_rules() -> None:
    text = "ООО СТИМБОТ\nИтого: 1500.00 ₽"
    default = _parse_transactions_from_text(text, "receipt.jpg")
    with_rule = _parse_transactions_from_text(
        text, "receipt.jpg", extra_rules={"стимбот": "Развлечения"}
    )
    assert default[0]["category"] == "Operations (Rent/Utility)"  # fallback без правила
    assert with_rule[0]["category"] == "Развлечения"
    assert with_rule[0]["description"].startswith("Стимбот")
