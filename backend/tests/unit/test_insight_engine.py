"""Unit tests for RuleBasedInsightEngine — pure in-memory, no DB.

generate() returns a multi-line personal plan; tests assert per-section presence
and the deterministic recommendation branch rather than one exact line.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from src.domain.models import CategoryType
from src.services.insight_engine import (
    BudgetData,
    RuleBasedInsightEngine,
    TransactionData,
)

ENGINE = RuleBasedInsightEngine()

FOOD = 1
SALARY = 2
CLOTHES = 3


def _tx(
    amount: str,
    category_id: int = FOOD,
    category_type: CategoryType = CategoryType.expense,
    day: int = 10,
    hour: int = 12,
) -> TransactionData:
    return TransactionData(
        amount=Decimal(amount),
        category_id=category_id,
        category_type=category_type,
        executed_at=datetime(2026, 7, day, hour, tzinfo=UTC),
    )


def _budget(limit: str, category_id: int = FOOD, name: str = "Еда") -> BudgetData:
    return BudgetData(category_id=category_id, category_name=name, amount_limit=Decimal(limit))


# ── Секция 1: Итог месяца (всегда) ──────────────────────────────────────


def test_summary_always_present_with_savings_rate() -> None:
    text = ENGINE.generate(
        [_tx("150000.00", SALARY, CategoryType.income), _tx("42500.50")], []
    )
    assert "📊 Итог месяца: доходы 150 000.00 ₽, расходы 42 500.50 ₽, отложено 107 499.50 ₽." in text
    assert "Норма сбережений: 72%." in text  # 107499.50 / 150000 → 71.7 → 72%


def test_summary_on_empty_month_has_no_rate() -> None:
    text = ENGINE.generate([], [])
    assert "📊 Итог месяца: доходы 0.00 ₽, расходы 0.00 ₽, отложено 0.00 ₽." in text
    assert "Норма сбережений" not in text  # income == 0 → rate suppressed


# ── Секция 2: Дефицит ───────────────────────────────────────────────────


def test_deficit_line_when_expense_exceeds_income() -> None:
    text = ENGINE.generate(
        [_tx("15600", SALARY, CategoryType.income), _tx("57910")], []
    )
    assert "⚠️ Расходы превысили доходы на 42 310.00 ₽ — месяц в минусе." in text


def test_no_deficit_line_when_positive() -> None:
    text = ENGINE.generate([_tx("1000", SALARY, CategoryType.income), _tx("300")], [])
    assert "месяц в минусе" not in text


# ── Секция 3: Статус бюджетов ───────────────────────────────────────────


def test_budget_alert_fires_at_80_percent() -> None:
    text = ENGINE.generate([_tx("8000")], [_budget("10000")])
    assert "⚠️ Бюджет «Еда»: потрачено 8 000.00 ₽ — это 80% лимита." in text


def test_budget_ok_when_under_threshold() -> None:
    text = ENGINE.generate([_tx("7999.99")], [_budget("10000")])
    assert "✅ Все бюджеты в пределах лимитов." in text


def test_budget_picks_most_exceeded_category() -> None:
    transactions = [_tx("9000", FOOD), _tx("5000", CLOTHES)]
    budgets = [_budget("10000", FOOD, "Еда"), _budget("5000", CLOTHES, "Одежда")]
    # Одежда: 100% лимита > Еда: 90% — алерт про одежду.
    text = ENGINE.generate(transactions, budgets)
    assert "Бюджет «Одежда»" in text
    assert "Бюджет «Еда»" not in text


def test_budget_section_absent_without_budgets() -> None:
    text = ENGINE.generate([_tx("500")], [])
    assert "Бюджет" not in text
    assert "Все бюджеты" not in text


def test_zero_limit_budget_ignored() -> None:
    transactions = [_tx("100000", SALARY, CategoryType.income)]
    budgets = [_budget("0", SALARY, "Зарплата")]
    text = ENGINE.generate(transactions, budgets)
    assert "⚠️ Бюджет" not in text
    assert "Все бюджеты" not in text  # limit <= 0 → not counted as a real budget


# ── Секция 4: Аномалия ──────────────────────────────────────────────────


def test_anomaly_fires_on_more_than_three_expenses_per_day() -> None:
    transactions = [_tx("100", day=15, hour=h) for h in (9, 12, 15, 18)]
    text = ENGINE.generate(transactions, [])
    assert "🕵️‍♂️ Пиковый день месяца: 4 трат за сутки" in text


def test_anomaly_not_fired_on_exactly_three_expenses() -> None:
    transactions = [_tx("100", day=15, hour=h) for h in (9, 12, 15)]
    text = ENGINE.generate(transactions, [])
    assert "Пиковый день" not in text


# ── Секция 5: Рекомендация (всегда) ─────────────────────────────────────


def test_recommendation_no_income() -> None:
    text = ENGINE.generate([_tx("500")], [])
    assert "👉 Рекомендация: добавьте доходы в учёт" in text


def test_recommendation_deficit_points_to_worst_category() -> None:
    transactions = [_tx("5000", SALARY, CategoryType.income), _tx("8000", FOOD)]
    text = ENGINE.generate(transactions, [_budget("10000", FOOD, "Еда")])
    assert (
        "👉 Рекомендация: сократите расходы минимум на 3 000.00 ₽, "
        "начните с категории «Еда», чтобы выйти в ноль." in text
    )


def test_recommendation_low_savings_rate() -> None:
    text = ENGINE.generate(
        [_tx("10000", SALARY, CategoryType.income), _tx("9500")], []
    )
    assert "старайтесь откладывать хотя бы 10% дохода — около 1 000.00 ₽ в месяц." in text


def test_recommendation_surplus() -> None:
    text = ENGINE.generate(
        [_tx("150000", SALARY, CategoryType.income), _tx("42500")], []
    )
    assert "у вас профицит 107 500.00 ₽ — разместите его" in text


# ── Структура и агрегаты ────────────────────────────────────────────────


def test_plan_is_multiline_with_summary_and_recommendation() -> None:
    text = ENGINE.generate([_tx("150000", SALARY, CategoryType.income), _tx("42500")], [])
    lines = text.split("\n")
    assert lines[0].startswith("📊")
    assert lines[-1].startswith("👉")
    assert len(lines) >= 2


def test_cashflow_totals() -> None:
    transactions = [
        _tx("1000", SALARY, CategoryType.income),
        _tx("300"),
        _tx("200"),
    ]
    assert ENGINE.cashflow_totals(transactions) == (Decimal("1000"), Decimal("500"))
