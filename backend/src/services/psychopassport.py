"""
Финансовый психопаспорт — детерминированный профиль поведения без LLM.

Чистая функция: принимает агрегаты периода (расходы по названиям категорий,
доход, расход) и возвращает персону, наблюдения и советы роста капитала.
Пороги фиксированы, деления на ноль защищены — движок юнит-тестируется без БД
и считается за микросекунды, в одном стиле с RuleBasedInsightEngine.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

# Пороги персон (детерминированные) ─────────────────────────────────────────
GROWTH_SHARE_INVESTOR = Decimal("0.15")
SAVINGS_RATE_SAVER = Decimal("0.30")
LEISURE_SHARE_SPENDER = Decimal("0.35")
OPERATIONS_SHARE_SURVIVOR = Decimal("0.60")
LOW_SAVINGS_RATE = Decimal("0.10")

# Ключевые слова названия категории → смысловой «конверт» трат.
_BUCKET_KEYWORDS: dict[str, tuple[str, ...]] = {
    "leisure": ("leisure", "lifestyle"),
    "operations": ("operations", "rent", "utility"),
    "wellness": ("wellness", "health"),
    "growth": ("growth", "invest"),
}


@dataclass(frozen=True)
class Psychopassport:
    """Профиль поведения: код персоны, заголовок, наблюдения и советы."""

    persona_code: str
    persona_title: str
    traits: list[str]
    recommendations: list[str]


def _bucket_sums(category_expense: dict[str, Decimal]) -> dict[str, Decimal]:
    """Суммы трат по «конвертам» — матчинг ключевых слов в названии без регистра."""
    sums: dict[str, Decimal] = {bucket: Decimal("0") for bucket in _BUCKET_KEYWORDS}
    for name, amount in category_expense.items():
        lowered = name.lower()
        for bucket, keywords in _BUCKET_KEYWORDS.items():
            if any(keyword in lowered for keyword in keywords):
                sums[bucket] += amount
    return sums


def _pct(share: Decimal) -> str:
    """0.6234 → '62%' — целый процент для наблюдений."""
    return f"{share * 100:.0f}%"


def _money(value: Decimal) -> str:
    """12345.6 → '12 346 ₽' — округлённая читаемая сумма для советов."""
    return f"{value:,.0f} ₽".replace(",", " ")


def build_psychopassport(
    category_expense: dict[str, Decimal],
    income: Decimal,
    expense: Decimal,
) -> Psychopassport:
    """
    Детерминированный психопаспорт по агрегатам периода.

    category_expense — {название категории: суммарный расход за период}.
    Персоны проверяются по порядку, берётся первая подходящая. Все доли и
    норма сбережений защищены от деления на ноль.
    """
    savings_rate = (income - expense) / income if income > 0 else Decimal("0")

    buckets = _bucket_sums(category_expense)
    if expense > 0:
        shares = {bucket: total / expense for bucket, total in buckets.items()}
    else:
        shares = dict.fromkeys(buckets, Decimal("0"))

    sr_trait = f"Норма сбережений {_pct(savings_rate)}"

    if shares["growth"] >= GROWTH_SHARE_INVESTOR:
        persona_code, persona_title = "investor", "Инвестор роста"
        traits = [f"{_pct(shares['growth'])} трат идёт в Инвестиции", sr_trait]
        recommendations = [
            "Реинвестируй дивиденды и купоны — сложный процент удвоит капитал быстрее",
            "Раз в квартал ребалансируй портфель, удерживая целевую долю активов",
        ]
    elif savings_rate >= SAVINGS_RATE_SAVER:
        persona_code, persona_title = "saver", "Копитель"
        traits = [f"{sr_trait} — выше среднего", "Расходы под контролем"]
        recommendations = [
            "Переводи накопления с депозита в диверсифицированный портфель — "
            "деньги должны обгонять инфляцию",
            "Настрой автоперевод на брокерский счёт в день зарплаты",
        ]
    elif shares["leisure"] >= LEISURE_SHARE_SPENDER:
        persona_code, persona_title = "lifestyle_spender", "Гедонист лайфстайла"
        cut = buckets["leisure"] * Decimal("0.15")
        traits = [f"{_pct(shares['leisure'])} трат — Лайфстайл", sr_trait]
        recommendations = [
            "Настрой автоперевод 10% дохода в конверт «Инвестиции» в день зарплаты",
            f"Урежь Лайфстайл на 15% — это ~{_money(cut)}/мес в капитал",
        ]
    elif shares["operations"] >= OPERATIONS_SHARE_SURVIVOR and savings_rate < LOW_SAVINGS_RATE:
        persona_code, persona_title = "survivor", "На базовых расходах"
        traits = [
            f"{_pct(shares['operations'])} трат — обязательные платежи (аренда/ЖКХ)",
            sr_trait,
        ]
        recommendations = [
            "Пересмотри тарифы и подписки — освободившиеся деньги направь в накопления",
            "Ищи способы поднять доход: даже +10% дохода снизят долю обязательных трат",
        ]
    else:
        persona_code, persona_title = "balanced", "Сбалансированный"
        traits = [sr_trait, "Траты распределены без явного перекоса"]
        recommendations = [
            "Держи правило 50/30/20 и направляй 20% дохода на инвестиции",
            "Открой брокерский счёт и настрой регулярные автопокупки индексного фонда",
        ]

    if savings_rate < LOW_SAVINGS_RATE:
        recommendations.append(
            "Собери подушку в 3 месяца обязательных расходов на отдельном ликвидном "
            "счёте — это фундамент перед инвестициями"
        )

    return Psychopassport(
        persona_code=persona_code,
        persona_title=persona_title,
        traits=traits,
        recommendations=recommendations,
    )
