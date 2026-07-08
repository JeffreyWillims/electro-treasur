"""
Калькулятор налоговых вычетов — чистая функция, без БД и без LLM (100% unit).

Возврат = 13% с суммы расходов, но не больше базового лимита по виду вычета и
не больше уплаченного за год НДФЛ (если доход указан). Лимиты — как в справочнике
(с 2024 года); справочно, не индивидуальная консультация.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

NDFL_RATE = Decimal("0.13")
_CENTS = Decimal("0.01")


# slug → (человекочитаемое имя, лимит базы, пояснение)
DEDUCTION_KINDS: dict[str, dict[str, object]] = {
    "treatment": {
        "label": "Лечение и лекарства",
        "base_limit": Decimal("150000"),
        "note": "Входит в общий социальный лимит 150 000 ₽ в год.",
    },
    "education_self": {
        "label": "Своё обучение",
        "base_limit": Decimal("150000"),
        "note": "Входит в общий социальный лимит 150 000 ₽ в год.",
    },
    "education_child": {
        "label": "Обучение ребёнка",
        "base_limit": Decimal("110000"),
        "note": "Отдельный лимит 110 000 ₽ на каждого ребёнка.",
    },
    "sport": {
        "label": "Спорт и фитнес",
        "base_limit": Decimal("150000"),
        "note": "Входит в общий социальный лимит 150 000 ₽ в год.",
    },
    "property": {
        "label": "Покупка жилья",
        "base_limit": Decimal("2000000"),
        "note": "Лимит базы 2 000 000 ₽ — к возврату до 260 000 ₽.",
    },
    "mortgage": {
        "label": "Проценты по ипотеке",
        "base_limit": Decimal("3000000"),
        "note": "Лимит базы 3 000 000 ₽ — к возврату до 390 000 ₽.",
    },
    "iis": {
        "label": "ИИС (тип А)",
        "base_limit": Decimal("400000"),
        "note": "Лимит взноса 400 000 ₽ в год — к возврату до 52 000 ₽.",
    },
}


def _money(value: Decimal) -> Decimal:
    return value.quantize(_CENTS, rounding=ROUND_HALF_UP)


def calculate_deduction(
    kind: str, amount: Decimal, annual_income: Decimal | None = None
) -> dict[str, object]:
    """
    Вернуть расчёт вычета. Бросает KeyError, если вид вычета неизвестен.

    amount ожидается >= 0; annual_income (если задан) ограничивает возврат
    уплаченным НДФЛ = 13% дохода.
    """
    cfg = DEDUCTION_KINDS[kind]
    base_limit = cfg["base_limit"]
    assert isinstance(base_limit, Decimal)

    eligible_base = min(amount, base_limit)
    refund = _money(eligible_base * NDFL_RATE)

    capped_by_income = False
    if annual_income is not None:
        ndfl_paid = _money(annual_income * NDFL_RATE)
        if refund > ndfl_paid:
            refund = ndfl_paid
            capped_by_income = True

    return {
        "kind": kind,
        "label": cfg["label"],
        "eligible_base": eligible_base,
        "refund": refund,
        "base_limit": base_limit,
        "capped_by_income": capped_by_income,
        "note": cfg["note"],
    }
