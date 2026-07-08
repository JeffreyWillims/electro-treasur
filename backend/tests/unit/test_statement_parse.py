"""Unit: parse_document_bytes extracts a candidate from a generated PDF (no DB)."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

from src.services.ai_vision_service import parse_document_bytes

_FONT = Path(__file__).resolve().parents[2] / "src" / "assets" / "fonts" / "DejaVuSans.ttf"


def _make_pdf(lines: list[str]) -> bytes:
    pdf = FPDF()
    pdf.add_font("D", "", str(_FONT))
    pdf.set_font("D", "", 14)
    pdf.add_page()
    for line in lines:
        pdf.cell(0, 10, line, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


async def test_parse_pdf_returns_expense_candidate() -> None:
    pdf = _make_pdf(["Магазин Пятёрочка", "Итого: 1 234,56 ₽"])
    candidates = await parse_document_bytes(pdf, "cheque.pdf")

    assert candidates, "parser should return at least one candidate"
    top = candidates[0]
    assert abs(float(top["amount"]) - 1234.56) < 0.01
    assert top["type"] in {"income", "expense"}


async def test_parse_empty_pdf_returns_none() -> None:
    pdf = _make_pdf([" "])  # no parseable amounts
    assert await parse_document_bytes(pdf, "blank.pdf") is None
