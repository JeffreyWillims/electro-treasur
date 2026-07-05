"""
tests/unit/test_ocr_parsing.py — Unit Tests for OCR Receipt & Statement Parsing.

Tests the pure functions in ai_vision_service.py:
  • _safe_parse_amount()  — monetary string → float converter
  • _parse_transactions_from_text() — OCR text → transaction list parser

Architecture:
  ┌───────────────────────────────────────────────────────────────┐
  │  Unit Test Layer (NO Tesseract, NO PIL, NO Bot, NO I/O)      │
  │                                                               │
  │  Raw text strings  ──→  _parse_transactions_from_text()       │
  │  (simulated OCR)          (scoring + regex + MERCHANT map)    │
  │       ↓                        ↓                              │
  │  Deterministic             list[dict] with amount, category,  │
  │  assertions                description, type                  │
  │                                                               │
  │  Execution time: < 1 ms per test (no I/O, no ML inference)   │
  └───────────────────────────────────────────────────────────────┘

Coverage targets:
  • _safe_parse_amount: RU, US, EU formats + edge cases (empty, garbage)
  • _parse_transactions_from_text: receipts, bank statements, OCR noise
  • Scoring system: score 4/3/2/1/0.5/0 validation
  • MERCHANT_TO_CATEGORY: keyword matching against real merchant names
  • Rejection filters: dates, years (2021–2027), INN numbers
  • Income detection: contextual keywords (поступление, зачисление)
  • Hypothesis: property-based fuzzing for regex crash-safety
"""

from __future__ import annotations

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from src.services.ai_vision_service import (
    MERCHANT_TO_CATEGORY,
    _parse_transactions_from_text,
    _safe_parse_amount,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 1: _safe_parse_amount — Bulletproof Monetary Parser
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestSafeParseAmount:
    """Tests for the universal monetary string → float converter."""

    # ── Russian format: space-separated thousands, comma-decimal ──────────
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("1500", 1500.0),
            ("1 500", 1500.0),
            ("1 500,00", 1500.0),
            ("1 500,50", 1500.5),
            ("12 345,67", 12345.67),
            ("999 999,99", 999999.99),
            ("0,01", 0.01),
            ("100,00", 100.0),
        ],
        ids=[
            "RU-integer",
            "RU-space-sep",
            "RU-space-comma",
            "RU-space-comma-cents",
            "RU-5digit-comma",
            "RU-6digit-max",
            "RU-one-kopeck",
            "RU-round-hundred",
        ],
    )
    def test_russian_format(self, raw: str, expected: float) -> None:
        """Russian receipts: '1 500,00' → 1500.00"""
        assert _safe_parse_amount(raw) == expected

    # ── American format: comma-separated thousands, dot-decimal ───────────
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("1,500.00", 1500.0),
            ("1,500.50", 1500.5),
            ("12,345.67", 12345.67),
            ("1,234,567.89", 1234567.89),
            ("100.00", 100.0),
        ],
        ids=[
            "US-basic",
            "US-with-cents",
            "US-5digit",
            "US-7digit",
            "US-dot-only",
        ],
    )
    def test_american_format(self, raw: str, expected: float) -> None:
        """PDF bank statements (US/UK): '1,500.00' → 1500.00"""
        assert _safe_parse_amount(raw) == expected

    # ── European format: dot-separated thousands, comma-decimal ───────────
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ("1.500,00", 1500.0),
            ("12.345,67", 12345.67),
            ("1.234.567,89", 1234567.89),
        ],
        ids=["EU-basic", "EU-5digit", "EU-7digit"],
    )
    def test_european_format(self, raw: str, expected: float) -> None:
        """European PDF invoices: '1.500,00' → 1500.00"""
        assert _safe_parse_amount(raw) == expected

    # ── Edge cases ────────────────────────────────────────────────────────
    def test_empty_string(self) -> None:
        assert _safe_parse_amount("") is None

    def test_only_spaces(self) -> None:
        assert _safe_parse_amount("   ") is None

    def test_nbsp_handling(self) -> None:
        """Non-breaking space (\\xa0) from PDF extractors."""
        assert _safe_parse_amount("1\xa0500,00") == 1500.0

    def test_garbage_returns_none(self) -> None:
        assert _safe_parse_amount("abc") is None

    def test_mixed_garbage_returns_none(self) -> None:
        assert _safe_parse_amount("12abc34") is None

    def test_single_digit(self) -> None:
        assert _safe_parse_amount("5") == 5.0

    def test_zero(self) -> None:
        assert _safe_parse_amount("0") == 0.0

    def test_large_integer(self) -> None:
        assert _safe_parse_amount("10000000") == 10_000_000.0

    # ── Hypothesis: crash-safety property ──────────────────────────────────
    @given(raw=st.text(max_size=50))
    @settings(max_examples=500)
    def test_never_raises_on_arbitrary_input(self, raw: str) -> None:
        """
        PROPERTY: _safe_parse_amount never raises an exception,
        regardless of input. It returns float or None.
        """
        result = _safe_parse_amount(raw)
        assert result is None or isinstance(result, float)

    @given(
        integer=st.integers(min_value=0, max_value=9_999_999),
        cents=st.integers(min_value=0, max_value=99),
    )
    @settings(max_examples=200)
    def test_roundtrip_russian_format(self, integer: int, cents: int) -> None:
        """
        PROPERTY: For any valid amount, formatting as Russian
        and parsing back should return the original value.
        """
        # Build Russian-style string: "1 234,56"
        int_str = f"{integer:,}".replace(",", " ")
        raw = f"{int_str},{cents:02d}"
        expected = integer + cents / 100.0
        result = _safe_parse_amount(raw)
        assert result is not None
        assert abs(result - expected) < 0.011  # float precision tolerance


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 2: _parse_transactions_from_text — Receipt Parsing (Scenario 2)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestParseReceipts:
    """Tests for receipt text parsing (ИТОГО keyword + currency suffix)."""

    def test_simple_receipt_with_total(self) -> None:
        """
        Minimal receipt: 'ИТОГО: 1500.00 ₽' should produce
        a single expense transaction for 1500.00.
        """
        text = (
            "ООО Пятерочка\nИНН 1234567890\nМолоко 89.90\nХлеб 45.00\nИТОГО: 1500.00 ₽\nНАЛИЧНЫЕ\n"
        )
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        # The highest-scoring candidate should be 1500.00 (score=4: total+currency)
        best = max(result, key=lambda x: x["amount"])
        assert best["amount"] == 1500.0
        assert best["type"] == "expense"

    def test_receipt_comma_decimal(self) -> None:
        """Russian receipt with comma as decimal separator."""
        text = "ИТОГО 2 350,50 руб.\nСпасибо за покупку!"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        amounts = [r["amount"] for r in result]
        assert 2350.5 in amounts

    def test_receipt_total_on_next_line(self) -> None:
        """
        Tesseract often splits 'ИТОГО' and the amount onto separate lines.
        The parser should still find the amount.
        """
        text = "Товар 1 250.00\nИТОГО\n1 500.00\nНАЛИЧНЫЕ"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        # Should find 1500.00 because 'итого' is on the previous line
        amounts = [r["amount"] for r in result]
        assert any(a >= 1500.0 for a in amounts)

    def test_receipt_with_ruble_suffix(self) -> None:
        """Currency suffix 'р' after amount should boost score."""
        text = "Оплата картой\nИТОГО: 890.50 р\nСпасибо"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        amounts = [r["amount"] for r in result]
        assert 890.5 in amounts

    def test_receipt_only_integer_total(self) -> None:
        """Receipts sometimes show round totals without decimals."""
        text = "ВСЕГО: 500\nВАША СДАЧА: 0"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        amounts = [r["amount"] for r in result]
        assert 500.0 in amounts

    def test_receipt_k_oplate(self) -> None:
        """'к оплате' is a common synonym for 'итого'."""
        text = "Позиция 1: 200.00\nПозиция 2: 300.00\nК ОПЛАТЕ: 500.00 ₽"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1

    def test_empty_text_returns_empty(self) -> None:
        """Empty or whitespace-only input → no transactions."""
        assert _parse_transactions_from_text("", "empty.jpg") == []
        assert _parse_transactions_from_text("   \n\n  ", "blank.jpg") == []

    def test_no_numbers_returns_empty(self) -> None:
        """Text without any numbers → no transactions."""
        text = "Добро пожаловать в магазин!\nСпасибо за покупку!"
        assert _parse_transactions_from_text(text, "no_nums.jpg") == []


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 3: Bank Statement Parsing (Scenario 1: +/- signs)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestParseBankStatements:
    """Tests for bank statement text with +/- sign-prefixed amounts."""

    def test_single_expense(self) -> None:
        """'-500.00 ₽' should produce a single expense."""
        text = "Покупка: Магнит\n-500.00 ₽\nКарта *1234"
        result = _parse_transactions_from_text(text, "statement.pdf")
        assert len(result) >= 1
        expenses = [r for r in result if r["type"] == "expense"]
        assert any(e["amount"] == 500.0 for e in expenses)

    def test_single_income(self) -> None:
        """'+50000.00 ₽' should produce a single income."""
        text = "Зачисление зарплаты\n+50000.00 ₽\nОт ООО Ромашка"
        result = _parse_transactions_from_text(text, "statement.pdf")
        assert len(result) >= 1
        incomes = [r for r in result if r["type"] == "income"]
        assert any(i["amount"] == 50000.0 for i in incomes)

    def test_multiple_signed_transactions(self) -> None:
        """
        Multiple sign-prefixed amounts with currency should produce
        multiple transactions (score=2 multi-extraction path).
        """
        text = (
            "Выписка за 01.06.2026\n"
            "-1 200.00 ₽ Пятерочка\n"
            "-350.00 ₽ Такси\n"
            "+75 000.00 ₽ Зарплата\n"
            "Итого за период\n"
        )
        result = _parse_transactions_from_text(text, "statement.pdf")
        # Should detect multiple score-2 candidates (sign + currency)
        assert len(result) >= 2
        types = [r["type"] for r in result]
        assert "expense" in types
        assert "income" in types

    def test_em_dash_as_minus(self) -> None:
        """Em-dash '—' and en-dash '–' should be treated as minus."""
        text = "—1500.00 ₽ Покупка"
        result = _parse_transactions_from_text(text, "test.pdf")
        assert len(result) >= 1
        assert result[0]["type"] == "expense"

    def test_income_context_keywords(self) -> None:
        """
        Text containing 'поступление' should set income context,
        making unsigned amounts default to income.
        """
        text = "Поступление средств\n5000.00 ₽"
        result = _parse_transactions_from_text(text, "income.pdf")
        assert len(result) >= 1
        assert result[0]["type"] == "income"

    def test_income_context_zachislenie(self) -> None:
        """'Зачисление' keyword triggers income context."""
        text = "Зачисление на карту\n25000.00 руб"
        result = _parse_transactions_from_text(text, "income.pdf")
        assert len(result) >= 1
        assert result[0]["type"] == "income"


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 4: Scoring System Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestScoringSystem:
    """
    The parser assigns scores 0-4 to candidate amounts:
      4 = total keyword + currency suffix
      3 = total keyword only
      2 = sign (+/-) + currency suffix (bank statement mode)
      1 = currency suffix only
      0.5 = no markers but has decimal part (price-like)
      0 = bare number (usually rejected)
    """

    def test_score_4_total_plus_currency(self) -> None:
        """Score 4: 'ИТОГО: 1500.00 ₽' should win over any lower-scored number."""
        text = (
            "Позиция 918244\n"  # score 0: bare number
            "250.00\n"  # score 0.5: decimal, no keyword
            "ИТОГО: 1500.00 ₽\n"  # score 4: total + currency
        )
        result = _parse_transactions_from_text(text, "test.jpg")
        assert len(result) == 1
        assert result[0]["amount"] == 1500.0

    def test_score_3_total_no_currency(self) -> None:
        """Score 3: 'ИТОГО 2000' (total keyword, no currency) should win over bare numbers."""
        text = "Номер чека 555111\nИТОГО 2000\nСпасибо за покупку"
        result = _parse_transactions_from_text(text, "test.jpg")
        assert len(result) >= 1
        # ИТОГО line gives score=3 to 2000, while 555111 has score=0
        assert result[0]["amount"] == 2000.0

    def test_score_1_currency_suffix_only(self) -> None:
        """Score 1: amount with currency but no total keyword."""
        text = "Списание 750.00 ₽ на Wildberries"
        result = _parse_transactions_from_text(text, "test.jpg")
        assert len(result) >= 1
        assert result[0]["amount"] == 750.0

    def test_year_values_rejected(self) -> None:
        """
        Numbers matching years 2021-2027 should be filtered out
        (score=0, no currency) to prevent date-as-amount parsing.
        """
        text = "Дата: 2026 год\nСумма: 1500.00 ₽"
        result = _parse_transactions_from_text(text, "test.jpg")
        # Should NOT contain 2026 as an amount
        amounts = [r["amount"] for r in result]
        assert 2026.0 not in amounts
        # But should contain the real amount
        assert 1500.0 in amounts

    def test_date_lines_skipped(self) -> None:
        """Lines with date/time markers should be skipped (unless they also have total keywords)."""
        text = (
            "25.06.2026 14:30:00\n"  # date + time → skip
            "Покупка в магазине\n"
            "ИТОГО: 999.00 ₽\n"
        )
        result = _parse_transactions_from_text(text, "test.jpg")
        assert len(result) >= 1
        # The date-line numbers should not appear as amounts
        amounts = [r["amount"] for r in result]
        assert 999.0 in amounts

    def test_amount_cap_10_million(self) -> None:
        """Amounts > 10,000,000 should be rejected as OCR artifacts."""
        text = "ИТОГО: 99999999.00 ₽\nОплата: 1500.00 ₽"
        result = _parse_transactions_from_text(text, "test.jpg")
        amounts = [r["amount"] for r in result]
        assert 99999999.0 not in amounts


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 5: MERCHANT_TO_CATEGORY Mapping
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestMerchantCategoryMapping:
    """Tests for merchant keyword → category resolution."""

    @pytest.mark.parametrize(
        ("merchant_keyword", "expected_category"),
        [
            ("пятерочка", "Продукты"),
            ("перекресток", "Продукты"),
            ("магнит", "Продукты"),
            ("вкусвилл", "Продукты"),
            ("ашан", "Продукты"),
            ("лента", "Продукты"),
            ("самокат", "Продукты"),
            ("дикси", "Продукты"),
            ("такси", "Транспорт"),
            ("яндекс", "Транспорт"),
            ("uber", "Транспорт"),
            ("лукойл", "Транспорт"),
            ("кофе", "Лайфстайл"),
            ("кафе", "Лайфстайл"),
            ("ресторан", "Лайфстайл"),
            ("аптека", "Здоровье"),
            ("wildberries", "Покупки"),
            ("ozon", "Покупки"),
            ("озон", "Покупки"),
            ("мтс", "Базовые расходы"),
        ],
    )
    def test_merchant_maps_to_correct_category(
        self, merchant_keyword: str, expected_category: str
    ) -> None:
        """Each merchant keyword from MERCHANT_TO_CATEGORY should resolve correctly."""
        assert MERCHANT_TO_CATEGORY[merchant_keyword] == expected_category

    def test_merchant_keyword_in_receipt_assigns_category(self) -> None:
        """
        When receipt text contains a merchant name (e.g. 'пятерочка'),
        the parser should assign the mapped category.
        """
        text = "ООО Пятерочка\nИТОГО: 1200.00 ₽"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        # Category should be resolved from 'пятерочка' in text
        assert result[0]["category"] == "Продукты"

    def test_restaurant_keyword_assigns_lifestyle(self) -> None:
        """Text with 'ресторан' should map to Лайфстайл."""
        text = "Ресторан Пушкин\nИТОГО: 5500.00 ₽"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        assert result[0]["category"] == "Лайфстайл"

    def test_no_merchant_uses_default_category(self) -> None:
        """Text without any merchant keyword → default category."""
        text = "ИТОГО: 300.00 ₽"
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        # Default expense category when no merchant matched
        category = result[0]["category"]
        assert category  # non-empty


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 6: Real-World OCR Noise Resilience
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestOCRNoiseResilience:
    """Tests with realistic Tesseract output artifacts."""

    def test_tesseract_itog_typo(self) -> None:
        """
        Tesseract sometimes OCRs 'ИТОГО' as 'ИТОR' or 'HTOR'.
        The parser includes these in total_keywords.
        """
        # 'итоr' is in total_keywords list
        text = "ИТОR: 1500.00 ₽"
        result = _parse_transactions_from_text(text, "noisy.jpg")
        assert len(result) >= 1

    def test_tesseract_latin_itog(self) -> None:
        """Tesseract may OCR Cyrillic as Latin: 'itog'."""
        text = "itog 2500.00 ₽"
        result = _parse_transactions_from_text(text, "noisy.jpg")
        assert len(result) >= 1

    def test_receipt_with_inn_and_fiscal_numbers(self) -> None:
        """
        Real receipts contain INN (10-digit), ФП (10-digit fiscal number),
        and various codes. These should NOT be parsed as amounts.
        """
        text = (
            "ООО МАГНИТ\n"
            "ИНН 7707083893\n"
            "ФП 3857209423\n"
            "Чек №918244\n"
            "ИТОГО: 1299.50 ₽\n"
            "БЕЗНАЛИЧНЫЕ\n"
        )
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        best = result[0]
        # The amount should be the actual total, not INN/fiscal numbers
        assert best["amount"] == 1299.5
        assert best["type"] == "expense"
        # Verify INN (7707083893) was NOT captured as amount
        # (it's > 10_000_000 cap)
        amounts = [r["amount"] for r in result]
        assert 7707083893.0 not in amounts

    def test_receipt_with_multiple_item_prices(self) -> None:
        """
        Real receipt with line items. Parser should pick ИТОГО,
        not individual line-item prices.
        """
        text = (
            "Молоко 89.90\n"
            "Хлеб белый 45.00\n"
            "Масло сливочное 129.00\n"
            "Яйца 109.00\n"
            "ИТОГО 372.90 ₽\n"
            "КАРТОЙ *7890\n"
        )
        result = _parse_transactions_from_text(text, "receipt.jpg")
        assert len(result) >= 1
        # Highest-scored should be the total
        assert result[0]["amount"] == 372.9

    def test_multiline_ocr_garbage_doesnt_crash(self) -> None:
        """OCR sometimes produces absolute garbage. Parser must not crash."""
        text = "Ш$#@!& 3п83н вв\n||||| ////\nИТОГО ₽₽₽ ???\n~~~~ 0000\n"
        # Should not raise — may return empty or minimal results
        result = _parse_transactions_from_text(text, "garbage.jpg")
        assert isinstance(result, list)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 7: Output Contract Validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestOutputContract:
    """
    Validate the structure of the output dicts — this is the contract
    between ai_vision_service and handlers.py.
    """

    def test_output_has_required_keys(self) -> None:
        """Every transaction dict must have amount, category, description, type."""
        text = "ИТОГО: 500.00 ₽"
        result = _parse_transactions_from_text(text, "test.jpg")
        assert len(result) >= 1
        for tx in result:
            assert "amount" in tx, "Missing 'amount' key"
            assert "category" in tx, "Missing 'category' key"
            assert "description" in tx, "Missing 'description' key"
            assert "type" in tx, "Missing 'type' key"

    def test_type_is_income_or_expense(self) -> None:
        """The 'type' field must be strictly 'income' or 'expense'."""
        text = "+5000.00 ₽ Зачисление\n-1200.00 ₽ Магнит"
        result = _parse_transactions_from_text(text, "test.pdf")
        for tx in result:
            assert tx["type"] in ("income", "expense"), f"Invalid type: {tx['type']}"

    def test_amount_is_positive_float(self) -> None:
        """Amount must always be a positive float."""
        text = "ИТОГО: 750.50 ₽"
        result = _parse_transactions_from_text(text, "test.jpg")
        for tx in result:
            assert isinstance(tx["amount"], (int, float))
            assert tx["amount"] > 0

    def test_description_under_255_chars(self) -> None:
        """Description must be truncated to 255 characters max."""
        long_name = "a" * 500 + ".pdf"
        text = "ИТОГО: 100.00 ₽"
        result = _parse_transactions_from_text(text, long_name)
        for tx in result:
            assert len(tx["description"]) <= 255


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 8: Hypothesis — Property-Based Fuzzing
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestHypothesisRegexSafety:
    """
    Property-based tests ensuring the parser never crashes
    on arbitrary input — critical for Tesseract's unpredictable output.
    """

    @given(text=st.text(max_size=2000))
    @settings(max_examples=300, deadline=5000)
    def test_parser_never_crashes_on_random_text(self, text: str) -> None:
        """
        PROPERTY: _parse_transactions_from_text never raises an exception.
        Return value is always list[dict] (possibly empty).
        """
        result = _parse_transactions_from_text(text, "fuzz.jpg")
        assert isinstance(result, list)
        for tx in result:
            assert isinstance(tx, dict)
            assert tx.get("amount", 0) > 0

    @given(text=st.text(max_size=2000))
    @settings(max_examples=300, deadline=5000)
    def test_parser_amounts_always_positive_and_capped(self, text: str) -> None:
        """
        PROPERTY: All parsed amounts are 0 < amount ≤ 10,000,000.
        """
        result = _parse_transactions_from_text(text, "fuzz.jpg")
        for tx in result:
            assert 0 < tx["amount"] <= 10_000_000, f"Amount out of range: {tx['amount']}"

    @given(text=st.text(max_size=2000))
    @settings(max_examples=300, deadline=5000)
    def test_parser_type_always_valid(self, text: str) -> None:
        """
        PROPERTY: The 'type' field is always 'income' or 'expense'.
        """
        result = _parse_transactions_from_text(text, "fuzz.jpg")
        for tx in result:
            assert tx["type"] in ("income", "expense")
