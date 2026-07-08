"""Unit tests for the pure `compute_health_score` formula (no DB)."""

from __future__ import annotations

from decimal import Decimal

import pytest

from src.services.health_score_service import compute_health_score


def test_zero_income_gives_zero_savings_factor() -> None:
    result = compute_health_score(
        avg_income=Decimal("0"),
        avg_expense=Decimal("500"),
        goals_progress_pct=None,
        budgets_within_limit_ratio=None,
    )
    savings = next(f for f in result["factors"] if f["name"] == "Норма сбережений")
    assert savings["score"] == 0
    # 0*0.5 + 60*0.25 + 60*0.25 = 30
    assert result["score"] == 30
    assert result["grade"] == "Требует внимания"


def test_twenty_percent_savings_rate_maxes_savings_factor() -> None:
    result = compute_health_score(
        avg_income=Decimal("100000"),
        avg_expense=Decimal("80000"),
        goals_progress_pct=None,
        budgets_within_limit_ratio=None,
    )
    savings = next(f for f in result["factors"] if f["name"] == "Норма сбережений")
    assert savings["score"] == 100
    # 100*0.5 + 60*0.25 + 60*0.25 = 80
    assert result["score"] == 80
    assert result["grade"] == "Отличное"


def test_savings_rate_above_twenty_percent_is_capped() -> None:
    result = compute_health_score(
        avg_income=Decimal("100"),
        avg_expense=Decimal("10"),  # 90% savings rate
        goals_progress_pct=100.0,
        budgets_within_limit_ratio=1.0,
    )
    savings = next(f for f in result["factors"] if f["name"] == "Норма сбережений")
    assert savings["score"] == 100
    assert result["score"] == 100
    assert result["grade"] == "Отличное"


def test_deficit_gives_zero_savings_factor() -> None:
    result = compute_health_score(
        avg_income=Decimal("1000"),
        avg_expense=Decimal("1500"),  # spending more than earning
        goals_progress_pct=None,
        budgets_within_limit_ratio=None,
    )
    savings = next(f for f in result["factors"] if f["name"] == "Норма сбережений")
    assert savings["score"] == 0
    assert result["score"] == 30
    assert result["grade"] == "Требует внимания"


def test_none_goals_and_budgets_are_neutral_60() -> None:
    result = compute_health_score(
        avg_income=Decimal("100"),
        avg_expense=Decimal("80"),
        goals_progress_pct=None,
        budgets_within_limit_ratio=None,
    )
    goals = next(f for f in result["factors"] if f["name"] == "Цели")
    budgets = next(f for f in result["factors"] if f["name"] == "Бюджеты")
    assert goals["score"] == 60
    assert budgets["score"] == 60


def test_structure_three_factors_with_weights() -> None:
    result = compute_health_score(
        avg_income=Decimal("100"),
        avg_expense=Decimal("80"),
        goals_progress_pct=50.0,
        budgets_within_limit_ratio=0.5,
    )
    names = [f["name"] for f in result["factors"]]
    assert names == ["Норма сбережений", "Цели", "Бюджеты"]
    weights = [f["weight"] for f in result["factors"]]
    assert weights == [0.5, 0.25, 0.25]
    assert 0 <= result["score"] <= 100
    for f in result["factors"]:
        assert 0 <= f["score"] <= 100
        assert isinstance(f["detail"], str)


@pytest.mark.parametrize(
    ("income", "expense", "goals", "budget", "expected_grade"),
    [
        # savings 100 (rate .2), goals 100, budget 1.0 -> 100
        (Decimal("100"), Decimal("80"), 100.0, 1.0, "Отличное"),
        # savings 80 (rate .16), goals 60, budget 0.6 -> 70
        (Decimal("100"), Decimal("84"), 60.0, 0.6, "Хорошее"),
        # savings 50 (rate .1), goals None, budget None -> 55
        (Decimal("100"), Decimal("90"), None, None, "Среднее"),
        # savings 0, goals 0, budget 0.0 -> 0
        (Decimal("100"), Decimal("100"), 0.0, 0.0, "Требует внимания"),
    ],
)
def test_grade_thresholds(
    income: Decimal,
    expense: Decimal,
    goals: float | None,
    budget: float | None,
    expected_grade: str,
) -> None:
    result = compute_health_score(
        avg_income=income,
        avg_expense=expense,
        goals_progress_pct=goals,
        budgets_within_limit_ratio=budget,
    )
    assert result["grade"] == expected_grade
