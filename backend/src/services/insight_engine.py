"""
Rule-Based Insight Engine — мгновенные финансовые советы без LLM.

Чистая бизнес-логика: принимает транзакции и бюджеты пользователя за месяц
в виде dataclass-«снимков» (без ORM/сессии) и возвращает одну готовую строку —
самое важное наблюдение по приоритету правил:

  1. Budget Alert   — категория съела ≥ 80% лимита бюджета.
  2. Anomaly        — больше 3 трат за один день (импульсивные покупки).
  3. Cashflow Summary — баланс месяца (fallback, срабатывает всегда).

Никакого I/O — движок юнит-тестируется без БД и считается за микросекунды.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from src.domain.models import CategoryType

BUDGET_ALERT_THRESHOLD = Decimal("0.8")
ANOMALY_DAILY_TX_LIMIT = 3


@dataclass(frozen=True)
class TransactionData:
    """Снимок транзакции — только поля, нужные правилам."""

    amount: Decimal
    category_id: int
    category_type: CategoryType
    executed_at: datetime


@dataclass(frozen=True)
class BudgetData:
    """Снимок месячного бюджета категории."""

    category_id: int
    category_name: str
    amount_limit: Decimal


def _format_money(value: Decimal) -> str:
    """1234567.5 → '1 234 567.50 ₽' — читаемая сумма для готового текста."""
    return f"{value:,.2f} ₽".replace(",", " ")


class RuleBasedInsightEngine:
    """«Меню» правил аналитики; generate() возвращает одну строку по приоритету."""

    def generate(
        self,
        transactions: Sequence[TransactionData],
        budgets: Sequence[BudgetData],
    ) -> str:
        """Самое важное наблюдение за период: Budget Alert → Anomaly → Summary."""
        return (
            self._budget_alert(transactions, budgets)
            or self._anomaly(transactions)
            or self._cashflow_summary(transactions)
        )

    def cashflow_totals(self, transactions: Sequence[TransactionData]) -> tuple[Decimal, Decimal]:
        """(доходы, расходы) за период — используется и правилами, и воркером."""
        income = sum(
            (tx.amount for tx in transactions if tx.category_type is CategoryType.income),
            Decimal("0"),
        )
        expense = sum(
            (tx.amount for tx in transactions if tx.category_type is CategoryType.expense),
            Decimal("0"),
        )
        return income, expense

    # ── Блюдо 1: Budget Alert ───────────────────────────────────────────
    def _budget_alert(
        self,
        transactions: Sequence[TransactionData],
        budgets: Sequence[BudgetData],
    ) -> str | None:
        spent_by_category: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        for tx in transactions:
            if tx.category_type is CategoryType.expense:
                spent_by_category[tx.category_id] += tx.amount

        worst: tuple[Decimal, BudgetData, Decimal] | None = None  # (ratio, budget, spent)
        for budget in budgets:
            if budget.amount_limit <= 0:
                continue
            spent = spent_by_category.get(budget.category_id, Decimal("0"))
            ratio = spent / budget.amount_limit
            if ratio >= BUDGET_ALERT_THRESHOLD and (worst is None or ratio > worst[0]):
                worst = (ratio, budget, spent)

        if worst is None:
            return None
        _, budget, spent = worst
        return (
            f"⚠️ Внимание: Вы потратили {_format_money(spent)} на {budget.category_name}. "
            "Бюджет почти исчерпан!"
        )

    # ── Блюдо 3: Anomaly ───────────────────────────────────────────────
    def _anomaly(self, transactions: Sequence[TransactionData]) -> str | None:
        expenses_per_day = Counter(
            tx.executed_at.date()
            for tx in transactions
            if tx.category_type is CategoryType.expense
        )
        if not expenses_per_day:
            return None
        _, count = expenses_per_day.most_common(1)[0]
        if count <= ANOMALY_DAILY_TX_LIMIT:
            return None
        return (
            f"🕵️‍♂️ Вы сегодня очень активны: {count} транзакций. "
            "Проверьте, нет ли импульсивных покупок."
        )

    # ── Блюдо 2: Cashflow Summary (fallback) ─────────────────────────────
    def _cashflow_summary(self, transactions: Sequence[TransactionData]) -> str:
        income, expense = self.cashflow_totals(transactions)
        saved = income - expense
        return (
            f"📊 Ваш баланс за месяц: Доходы {_format_money(income)}, "
            f"Расходы {_format_money(expense)}. Отложено: {_format_money(saved)}."
        )
