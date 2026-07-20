"""
Rule-Based Insight Engine — персональный финансовый план без LLM.

Чистая бизнес-логика: принимает транзакции и бюджеты пользователя за месяц
в виде dataclass-«снимков» (без ORM/сессии) и возвращает готовый многострочный
план (рендерится как есть, `whitespace-pre-line`). Тон — человеческий, без
эмодзи. Секции по приоритету, каждая включается только при наличии данных:

  1. Итог периода — заработано/потрачено/отложено + доля дохода (всегда).
  2. Дефицит      — расходы превысили доходы.
  3. Бюджеты      — худшая категория (≥80% лимита: «почти на пределе»/«за лимитом») или «в норме».
  4. Аномалия     — пиковый день с > 3 трат (импульсивные покупки).
  5. Совет        — детерминированная actionable-рекомендация (всегда).

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


TARGET_SAVINGS_RATE = Decimal("0.10")


class RuleBasedInsightEngine:
    """«Меню» правил аналитики; generate() собирает персональный план по секциям."""

    def generate(
        self,
        transactions: Sequence[TransactionData],
        budgets: Sequence[BudgetData],
    ) -> str:
        """Многострочный персональный план: итог → дефицит → бюджеты → аномалия → совет."""
        income, expense = self.cashflow_totals(transactions)
        lines = [self._summary_line(income, expense)]
        for section in (
            self._deficit_line(income, expense),
            self._budget_status(transactions, budgets),
            self._anomaly(transactions),
        ):
            if section:
                lines.append(section)
        lines.append(self._recommendation(income, expense, transactions, budgets))
        return "\n".join(lines)

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

    # ── Секция 1: Итог периода (всегда) ─────────────────────────────────
    # «Период», а не «месяц»: движок обслуживает отчёты за день/неделю/год.
    def _summary_line(self, income: Decimal, expense: Decimal) -> str:
        saved = income - expense
        if income <= 0 and expense <= 0:
            return "Итог периода: операций за период пока не было."
        if income <= 0:
            return f"Итог периода: доходов в учёте пока нет, расходы — {_format_money(expense)}."
        line = (
            f"Итог периода: вы заработали {_format_money(income)} "
            f"и потратили {_format_money(expense)}."
        )
        if saved >= 0:
            rate = saved / income * 100
            line += f" Отложить удалось {_format_money(saved)} — это {rate:.0f}% дохода."
        return line

    # ── Секция 2: Дефицит ───────────────────────────────────────────────
    def _deficit_line(self, income: Decimal, expense: Decimal) -> str | None:
        saved = income - expense
        if saved >= 0:
            return None
        return (
            f"В этом месяце в жизнь вложено больше, чем пришло, — "
            f"разница {_format_money(-saved)}. Так бывает, и это поправимо."
        )

    # ── Секция 3: Статус бюджетов ───────────────────────────────────────
    def _budget_status(
        self,
        transactions: Sequence[TransactionData],
        budgets: Sequence[BudgetData],
    ) -> str | None:
        worst = self._worst_budget(transactions, budgets)
        if worst is not None:
            ratio, name, spent = worst
            if ratio >= 1:
                return (
                    f"Бюджет «{name}» вышел за лимит: потрачено {_format_money(spent)} — "
                    f"{ratio * 100:.0f}%. Ничего страшного, в следующем месяце подровняем."
                )
            return (
                f"Бюджет «{name}» почти на пределе: потрачено {_format_money(spent)} — "
                f"{ratio * 100:.0f}% лимита. Хороший момент немного притормозить."
            )
        if any(b.amount_limit > 0 for b in budgets):
            return "Все бюджеты в пределах лимитов — вы отлично держите курс."
        return None

    # ── Секция 4: Аномалия ──────────────────────────────────────────────
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
            f"Самый активный день: {count} трат за сутки — при случае загляните, "
            "всё ли здесь было в радость."
        )

    # ── Секция 5: Совет (всегда) ────────────────────────────────────────
    def _recommendation(
        self,
        income: Decimal,
        expense: Decimal,
        transactions: Sequence[TransactionData],
        budgets: Sequence[BudgetData],
    ) -> str:
        saved = income - expense
        if income <= 0:
            return "Совет: добавьте доходы в учёт — картина станет полнее, а подсказки точнее."
        if saved < 0:
            worst = self._worst_budget(transactions, budgets)
            step = (
                f" Мягкий шаг: загляните в категорию «{worst[1]}» — там обычно и прячется резерв."
                if worst
                else " Мягкий шаг: начните с самой заметной траты месяца — этого часто достаточно."
            )
            return (
                f"Совет: чтобы выйти в ноль, стоит вернуть баланс "
                f"на {_format_money(-saved)}.{step}"
            )
        if saved / income < TARGET_SAVINGS_RATE:
            target = income * TARGET_SAVINGS_RATE
            return (
                "Совет: попробуйте откладывать хотя бы 10% дохода — "
                f"это около {_format_money(target)} в месяц."
            )
        return (
            f"Совет: у вас профицит {_format_money(saved)}. "
            "Пусть эти деньги работают — вклад или инвестиции."
        )

    # ── Общий помощник: худшая пробитая категория (≥80% лимита) ─────────
    def _worst_budget(
        self,
        transactions: Sequence[TransactionData],
        budgets: Sequence[BudgetData],
    ) -> tuple[Decimal, str, Decimal] | None:
        """(ratio, category_name, spent) для самой пробитой категории или None."""
        spent_by_category: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        for tx in transactions:
            if tx.category_type is CategoryType.expense:
                spent_by_category[tx.category_id] += tx.amount

        worst: tuple[Decimal, str, Decimal] | None = None
        for budget in budgets:
            if budget.amount_limit <= 0:
                continue
            spent = spent_by_category.get(budget.category_id, Decimal("0"))
            ratio = spent / budget.amount_limit
            if ratio >= BUDGET_ALERT_THRESHOLD and (worst is None or ratio > worst[0]):
                worst = (ratio, budget.category_name, spent)
        return worst
