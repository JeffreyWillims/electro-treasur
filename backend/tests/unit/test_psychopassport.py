"""Unit tests for build_psychopassport — pure in-memory, deterministic, no DB.

Один кейс на каждую из 5 персон (вход подобран под порог, с учётом порядка
проверки) плюс edge-кейсы деления на ноль (income=0, expense=0).
"""

from __future__ import annotations

from decimal import Decimal

from src.services.psychopassport import Psychopassport, build_psychopassport

VALID_CODES = {"investor", "saver", "lifestyle_spender", "survivor", "balanced"}


# ── Персоны (порядок проверки важен) ────────────────────────────────────


def test_investor_when_growth_share_at_threshold() -> None:
    pp = build_psychopassport(
        {"Growth (Investments)": Decimal("2000"), "Operations (Rent/Utility)": Decimal("8000")},
        income=Decimal("10000"),
        expense=Decimal("10000"),
    )
    assert pp.persona_code == "investor"
    assert pp.persona_title == "Инвестор роста"
    assert 2 <= len(pp.traits) <= 3
    assert 2 <= len(pp.recommendations) <= 3


def test_saver_when_savings_rate_high_and_no_growth() -> None:
    pp = build_psychopassport(
        {"Operations (Rent/Utility)": Decimal("5000")},
        income=Decimal("10000"),
        expense=Decimal("5000"),  # savings_rate 0.50
    )
    assert pp.persona_code == "saver"


def test_lifestyle_spender_when_leisure_dominates() -> None:
    pp = build_psychopassport(
        {"Leisure (Lifestyle)": Decimal("4000"), "Operations (Rent/Utility)": Decimal("5000")},
        income=Decimal("10000"),
        expense=Decimal("9000"),  # savings_rate 0.10, leisure_share 0.44
    )
    assert pp.persona_code == "lifestyle_spender"
    assert any("15%" in r or "Инвестиции" in r for r in pp.recommendations)


def test_survivor_when_operations_dominate_and_low_savings() -> None:
    pp = build_psychopassport(
        {"Operations (Rent/Utility)": Decimal("7000"), "Wellness (Health)": Decimal("2500")},
        income=Decimal("10000"),
        expense=Decimal("9500"),  # savings_rate 0.05, operations_share 0.74
    )
    assert pp.persona_code == "survivor"
    # savings_rate < 0.10 → добавлен совет про подушку.
    assert any("подушк" in r.lower() for r in pp.recommendations)
    assert len(pp.recommendations) == 3


def test_balanced_is_default_without_strong_signal() -> None:
    pp = build_psychopassport(
        {
            "Operations (Rent/Utility)": Decimal("4000"),
            "Wellness (Health)": Decimal("2000"),
            "Leisure (Lifestyle)": Decimal("2000"),
        },
        income=Decimal("10000"),
        expense=Decimal("8000"),  # savings_rate 0.20, все доли ниже порогов
    )
    assert pp.persona_code == "balanced"
    assert len(pp.recommendations) == 2  # sr 0.20 ≥ 0.10 → без подушки


# ── Edge: деление на ноль ────────────────────────────────────────────────


def test_zero_income_does_not_crash() -> None:
    pp = build_psychopassport(
        {"Operations (Rent/Utility)": Decimal("5000")},
        income=Decimal("0"),
        expense=Decimal("5000"),
    )
    assert isinstance(pp, Psychopassport)
    assert pp.persona_code in VALID_CODES
    assert pp.traits and pp.recommendations


def test_zero_expense_does_not_crash() -> None:
    pp = build_psychopassport(
        {},
        income=Decimal("10000"),
        expense=Decimal("0"),  # savings_rate 1.0 → saver, доли не делятся на ноль
    )
    assert pp.persona_code == "saver"
    assert pp.traits and pp.recommendations
