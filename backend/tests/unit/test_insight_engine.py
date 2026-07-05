"""Unit tests for RuleBasedInsightEngine — pure in-memory, no DB."""

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


# ── Блюдо 1: Budget Alert ────────────────────────────────────────────────


def test_budget_alert_fires_at_80_percent() -> None:
    text = ENGINE.generate([_tx("8000")], [_budget("10000")])
    assert text == "⚠️ Внимание: Вы потратили 8 000.00 ₽ на Еда. Бюджет почти исчерпан!"


def test_budget_alert_not_fired_below_threshold() -> None:
    text = ENGINE.generate([_tx("7999.99")], [_budget("10000")])
    assert "⚠️" not in text
    assert text.startswith("📊")


def test_budget_alert_picks_most_exceeded_category() -> None:
    clothes = 3
    transactions = [_tx("9000", FOOD), _tx("5000", clothes)]
    budgets = [_budget("10000", FOOD, "Еда"), _budget("5000", clothes, "Одежда")]
    # Одежда: 100% лимита > Еда: 90% — алерт про одежду.
    text = ENGINE.generate(transactions, budgets)
    assert "Одежда" in text


def test_budget_alert_ignores_income_and_zero_limits() -> None:
    transactions = [_tx("100000", SALARY, CategoryType.income)]
    budgets = [_budget("0", SALARY, "Зарплата")]
    text = ENGINE.generate(transactions, budgets)
    assert "⚠️" not in text


# ── Блюдо 3: Anomaly ─────────────────────────────────────────────────────


def test_anomaly_fires_on_more_than_three_expenses_per_day() -> None:
    transactions = [_tx("100", day=15, hour=h) for h in (9, 12, 15, 18)]
    text = ENGINE.generate(transactions, [])
    assert text == (
        "🕵️‍♂️ Вы сегодня очень активны: 4 транзакций. Проверьте, нет ли импульсивных покупок."
    )


def test_anomaly_not_fired_on_exactly_three_expenses() -> None:
    transactions = [_tx("100", day=15, hour=h) for h in (9, 12, 15)]
    text = ENGINE.generate(transactions, [])
    assert text.startswith("📊")


# ── Блюдо 2: Cashflow Summary (fallback) ─────────────────────────────────


def test_cashflow_summary_parses_ready_data() -> None:
    transactions = [
        _tx("150000.00", SALARY, CategoryType.income),
        _tx("42500.50"),
    ]
    text = ENGINE.generate(transactions, [])
    assert text == (
        "📊 Ваш баланс за месяц: Доходы 150 000.00 ₽, Расходы 42 500.50 ₽. Отложено: 107 499.50 ₽."
    )


def test_cashflow_summary_on_empty_month() -> None:
    text = ENGINE.generate([], [])
    assert text == ("📊 Ваш баланс за месяц: Доходы 0.00 ₽, Расходы 0.00 ₽. Отложено: 0.00 ₽.")


# ── Приоритет правил ────────────────────────────────────────────────────


def test_budget_alert_wins_over_anomaly_and_summary() -> None:
    # 4 траты в один день (аномалия) + пробитый бюджет — побеждает Budget Alert.
    transactions = [_tx("3000", day=15, hour=h) for h in (9, 12, 15, 18)]
    text = ENGINE.generate(transactions, [_budget("12000")])
    assert text.startswith("⚠️")


def test_cashflow_totals() -> None:
    transactions = [
        _tx("1000", SALARY, CategoryType.income),
        _tx("300"),
        _tx("200"),
    ]
    assert ENGINE.cashflow_totals(transactions) == (Decimal("1000"), Decimal("500"))
