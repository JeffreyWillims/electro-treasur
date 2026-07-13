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


# ── Секция 1: Итог периода (всегда) ──────────────────────────────────────


def test_summary_always_present_with_savings_rate() -> None:
    text = ENGINE.generate(
        [_tx("150000.00", SALARY, CategoryType.income), _tx("42500.50")], []
    )
    assert (
        "Итог периода: вы заработали 150 000.00 ₽ и потратили 42 500.50 ₽. "
        "Отложить удалось 107 499.50 ₽ — это 72% дохода." in text
    )
    # 107499.50 / 150000 → 71.7 → 72% (доля дохода в той же фразе выше)


def test_summary_on_empty_month_has_no_rate() -> None:
    text = ENGINE.generate([], [])
    assert "Итог периода: операций за период пока не было." in text
    assert "% дохода" not in text  # income == 0 → доля дохода не считается


# ── Секция 2: Дефицит ───────────────────────────────────────────────────


def test_deficit_line_when_expense_exceeds_income() -> None:
    text = ENGINE.generate(
        [_tx("15600", SALARY, CategoryType.income), _tx("57910")], []
    )
    assert "Расходы превысили доходы на 42 310.00 ₽ — период уходит в минус." in text


def test_no_deficit_line_when_positive() -> None:
    text = ENGINE.generate([_tx("1000", SALARY, CategoryType.income), _tx("300")], [])
    assert "идёт в минус" not in text


# ── Секция 3: Статус бюджетов ───────────────────────────────────────────


def test_budget_alert_fires_at_80_percent() -> None:
    text = ENGINE.generate([_tx("8000")], [_budget("10000")])
    assert "Бюджет «Еда» на исходе: потрачено 8 000.00 ₽ — 80% лимита." in text


def test_budget_ok_when_under_threshold() -> None:
    text = ENGINE.generate([_tx("7999.99")], [_budget("10000")])
    assert "Все бюджеты в пределах лимитов — хорошая дисциплина." in text


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
    assert "Бюджет «" not in text
    assert "Все бюджеты" not in text  # limit <= 0 → not counted as a real budget


# ── Секция 4: Аномалия ──────────────────────────────────────────────────


def test_anomaly_fires_on_more_than_three_expenses_per_day() -> None:
    transactions = [_tx("100", day=15, hour=h) for h in (9, 12, 15, 18)]
    text = ENGINE.generate(transactions, [])
    assert "Самый насыщенный день: 4 трат за сутки" in text


def test_anomaly_not_fired_on_exactly_three_expenses() -> None:
    transactions = [_tx("100", day=15, hour=h) for h in (9, 12, 15)]
    text = ENGINE.generate(transactions, [])
    assert "насыщенный день" not in text


# ── Секция 5: Рекомендация (всегда) ─────────────────────────────────────


def test_recommendation_no_income() -> None:
    text = ENGINE.generate([_tx("500")], [])
    assert "Совет: добавьте доходы в учёт" in text


def test_recommendation_deficit_points_to_worst_category() -> None:
    transactions = [_tx("5000", SALARY, CategoryType.income), _tx("8000", FOOD)]
    text = ENGINE.generate(transactions, [_budget("10000", FOOD, "Еда")])
    assert (
        "Совет: чтобы выйти в ноль, сократите расходы минимум "
        "на 3 000.00 ₽ — начните с категории «Еда»." in text
    )


def test_recommendation_low_savings_rate() -> None:
    text = ENGINE.generate(
        [_tx("10000", SALARY, CategoryType.income), _tx("9500")], []
    )
    assert "попробуйте откладывать хотя бы 10% дохода — это около 1 000.00 ₽ в месяц." in text


def test_recommendation_surplus() -> None:
    text = ENGINE.generate(
        [_tx("150000", SALARY, CategoryType.income), _tx("42500")], []
    )
    assert "у вас профицит 107 500.00 ₽. Пусть эти деньги работают" in text


# ── Структура и агрегаты ────────────────────────────────────────────────


def test_plan_is_multiline_with_summary_and_recommendation() -> None:
    text = ENGINE.generate([_tx("150000", SALARY, CategoryType.income), _tx("42500")], [])
    lines = text.split("\n")
    assert lines[0].startswith("Итог периода")
    assert lines[-1].startswith("Совет:")
    assert len(lines) >= 2


def test_cashflow_totals() -> None:
    transactions = [
        _tx("1000", SALARY, CategoryType.income),
        _tx("300"),
        _tx("200"),
    ]
    assert ENGINE.cashflow_totals(transactions) == (Decimal("1000"), Decimal("500"))
