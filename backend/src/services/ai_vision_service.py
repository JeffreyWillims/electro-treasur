import asyncio
import io
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
import pdfplumber
import pytesseract
from aiogram import Bot
from PIL import Image, ImageOps, ImageFilter

logger = logging.getLogger(__name__)

TOTAL_KEYWORDS = [
    r"итого", r"сумма", r"всего", r"оплат", r"total", r"amount",
    r"paid", r"grand", r"check", r"итог"
]


def _preprocess_image(image_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(image_bytes))
    img = ImageOps.grayscale(img)
    img = ImageOps.autocontrast(img)
    img = img.filter(ImageFilter.SHARPEN)
    img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
    return img


def _parse_smart_amount(text: str) -> Decimal | None:
    lines = [line.strip().lower() for line in text.split('\n') if line.strip()]
    if not lines: return None

    # ─── ШАГ 0: Банковские переводы (Тинькофф, Сбер и т.д.) ──────────────
    # Ищем строгий паттерн в начале строки: минус/плюс, затем число (например "-45 510 ₽")
    for line in lines:
        match = re.search(r"^([-+])\s*(\d{1,3}(?:[ \s]?\d{3})*(?:[.,]\d{2})?)", line)
        if match:
            try:
                # Убираем пробелы тысяч: "45 510" -> "45510"
                val = Decimal(match.group(2).replace(" ", "").replace(",", "."))
                if 0 < val < 10000000:
                    return val
            except (InvalidOperation, ValueError):
                continue

    # ─── ШАГ 1: Ищем суммы рядом с ключевыми словами (старый код) ────────
    for i, line in enumerate(lines):
        if any(re.search(kw, line) for kw in TOTAL_KEYWORDS):
            look_in = line + (lines[i+1] if i+1 < len(lines) else "")
            matches = re.findall(r"(\d+[\s\d]*[.,]\d{2})", look_in)
            if matches:
                try:
                    val = Decimal(matches[-1].replace(" ", "").replace(",", "."))
                    if 0 < val < 1000000: return val
                except: continue

    # ─── ШАГ 2: Fallback (старый код) ────────────────────────────────────
    all_prices = re.findall(r"\b\d{1,6}[.,]\d{2}\b", "\n".join(lines[-10:]))
    candidates = []
    for p in all_prices:
        try:
            val = Decimal(p.replace(",", "."))
            if val == Decimal(datetime.now().year): continue
            candidates.append(val)
        except: continue

    if candidates: return max(candidates)
    return None

def _extract_from_excel(file_bytes: bytes) -> list[dict[str, Any]]:
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
        df = df.dropna(how='all').dropna(axis=1, how='all')
        results = []
        numeric_cols = df.select_dtypes(include=['number']).columns
        if not numeric_cols.empty:
            target_col = numeric_cols[0]
            for _, row in df.iterrows():
                amt = abs(float(row[target_col]))
                if amt > 0:
                    results.append({
                        "amount": amt,
                        "category": "Operations (Rent/Utility)",
                        "description": f"Excel: {str(row.iloc[0])[:30]}",
                        "type": "expense"
                    })
        return results
    except Exception as e:
        logger.error(f"Excel error: {e}")
        return []


async def analyze_document_universal(
        bot: Bot, file_id: str, file_name: str
) -> list[dict[str, Any]] | None:
    try:
        file_info = await bot.get_file(file_id)
        downloaded = await bot.download_file(file_info.file_path)
        content = downloaded.read()
        ext = file_name.split('.')[-1].lower()

        if ext in ['xlsx', 'xls']:
            return await asyncio.to_thread(_extract_from_excel, content)

        text = ""
        if ext == 'pdf':
            try:
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    text = "\n".join([p.extract_text() or "" for p in pdf.pages])
            except Exception as e:
                logger.error(f"PDF error: {e}")

        if not text.strip():
            processed_img = await asyncio.to_thread(_preprocess_image, content)
            text = await asyncio.to_thread(pytesseract.image_to_string, processed_img, lang="rus+eng")

        amount = _parse_smart_amount(text)

        if amount:
            return [{
                "amount": float(amount),
                "category": "Operations (Rent/Utility)",
                "description": f"Документ: {file_name}",
                "type": "expense"
            }]
        return None

    except Exception as e:
        logger.error(f"Universal Parser Error: {e}")
        return None