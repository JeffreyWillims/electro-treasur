"""
PDF-отчёт «Личный финансовый план» — серверная генерация (fpdf2).

Собирает готовый инсайт (RuleBasedInsightEngine) и цели-накопления пользователя
в одностраничный PDF. Кириллица — через встроенный DejaVuSans (репозиторный
шрифт, одинаковый на хосте и в Docker; system-шрифты не нужны).
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from fpdf import FPDF

from src.domain.models import Insight, SavingsGoal

_FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
_ORANGE = (255, 122, 0)
_DARK = (28, 63, 53)


def _money(value: str | Decimal) -> str:
    return f"{Decimal(value):,.2f} ₽".replace(",", " ")


def build_financial_plan_pdf(
    *,
    full_name: str | None,
    email: str,
    insight: Insight | None,
    goals: Sequence[SavingsGoal],
) -> bytes:
    """Возвращает PDF (bytes) с финансовым планом пользователя."""
    pdf = FPDF()
    pdf.add_font("DejaVu", "", str(_FONT_DIR / "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", "B", str(_FONT_DIR / "DejaVuSans-Bold.ttf"))
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_text_color(*_DARK)
    pdf.set_font("DejaVu", "B", 22)
    pdf.cell(0, 12, "Личный финансовый план", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(120, 120, 120)
    who = full_name or email
    generated = datetime.now(UTC).strftime("%Y-%m-%d")
    pdf.cell(0, 7, f"{who} · сформирован {generated}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # ── Финансовый вывод ────────────────────────────────────────────────
    _heading(pdf, "Финансовый вывод")
    pdf.set_font("DejaVu", "", 11)
    pdf.set_text_color(*_DARK)
    if insight is not None:
        s = insight.summary
        period = f"{insight.period_start} — {insight.period_end}"
        pdf.cell(0, 7, f"Период: {period}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 7, f"Доходы: {_money(str(s.get('total_income', '0')))}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 7, f"Расходы: {_money(str(s.get('total_expense', '0')))}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 7, f"Отложено: {_money(str(s.get('saved', '0')))}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)
        _heading(pdf, "Рекомендации")
        pdf.set_font("DejaVu", "", 11)
        pdf.set_text_color(*_DARK)
        pdf.multi_cell(0, 7, insight.advice)
    else:
        pdf.multi_cell(
            0, 7, "Пока недостаточно данных для анализа. Добавьте транзакции за месяц."
        )
    pdf.ln(4)

    # ── Цели ────────────────────────────────────────────────────────────
    _heading(pdf, "Цели-накопления")
    pdf.set_font("DejaVu", "", 11)
    pdf.set_text_color(*_DARK)
    if goals:
        for g in goals:
            pct = min(g.current_amount / g.target_amount * 100, Decimal("100"))
            pdf.cell(
                0,
                7,
                f"• {g.name}: {_money(g.current_amount)} из {_money(g.target_amount)} "
                f"({pct:.0f}%)",
                new_x="LMARGIN",
                new_y="NEXT",
            )
    else:
        pdf.cell(0, 7, "Цели ещё не заданы.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(8)
    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(0, 6, "Citrine Vault · отчёт носит информационный характер", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def _heading(pdf: FPDF, text: str) -> None:
    pdf.set_font("DejaVu", "B", 14)
    pdf.set_text_color(*_ORANGE)
    pdf.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
