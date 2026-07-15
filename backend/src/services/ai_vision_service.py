import asyncio
import io
import logging
import re
from typing import Any

import pandas as pd
import pdfplumber
import pytesseract
from aiogram import Bot
from PIL import Image, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

MERCHANT_TO_CATEGORY = {
    "такси": "Транспорт",
    "яндекс": "Транспорт",
    "uber": "Транспорт",
    "азс": "Транспорт",
    "лукойл": "Транспорт",
    "газпромнефть": "Транспорт",
    "пятерочка": "Продукты",
    "магнит": "Продукты",
    "вкусвилл": "Продукты",
    "перекресток": "Продукты",
    "ашан": "Продукты",
    "лента": "Продукты",
    "самокат": "Продукты",
    "спар": "Продукты",
    "spar": "Продукты",
    "дикси": "Продукты",
    "кофе": "Лайфстайл",
    "кафе": "Лайфстайл",
    "ресторан": "Лайфстайл",
    "вкусно": "Лайфстайл",
    "аптека": "Здоровье",
    "wildberries": "Покупки",
    "ozon": "Покупки",
    "озон": "Покупки",
    "dns": "Покупки",
    "днс": "Покупки",
    "мвидео": "Покупки",
    "ситилинк": "Покупки",
    "жкх": "Базовые расходы",
    "связь": "Базовые расходы",
    "мтс": "Базовые расходы",
}


def resolve_merchant_category(
    text_lower: str, extra_rules: dict[str, str] | None = None
) -> tuple[str, str] | None:
    """
    (категория, ключевое слово) по словарю мерчантов или None.

    `extra_rules` — правила из таблицы merchant_rules (SQLAdmin): дополняют
    встроенный словарь, при совпадении ключа — переопределяют его.
    """
    rules = {**MERCHANT_TO_CATEGORY, **(extra_rules or {})}
    for kw, cat_name in rules.items():
        if kw and kw in text_lower:
            return cat_name, kw
    return None


def _safe_parse_amount(raw: str) -> float | None:
    """Parse monetary string into float, handling RU/US/EU formats.

    Supports:
      "1 500,00"  → 1500.00  (RU: space-separated, comma-decimal)
      "1,500.00"  → 1500.00  (US: comma-separated, dot-decimal)
      "1.500,00"  → 1500.00  (EU: dot-separated, comma-decimal)
      "1500"      → 1500.00  (plain integer)

    Returns None on any parse failure. Never raises.
    """
    s = raw.replace(" ", "").replace("\xa0", "")
    if not s:
        return None

    last_dot = s.rfind(".")
    last_comma = s.rfind(",")

    if last_dot > last_comma:
        s = s.replace(",", "")
    elif last_comma > last_dot:
        s = s.replace(".", "").replace(",", ".")

    try:
        return float(s)
    except ValueError:
        return None


def _preprocess_image(image_bytes: bytes) -> Image.Image:
    """Подготовка изображения для лучшего распознавания OCR.

    Note: Caller is responsible for closing the returned Image
    (handled via `finally: processed_img.close()` in analyze_document_universal).
    """
    raw_img = Image.open(io.BytesIO(image_bytes))
    try:
        img = ImageOps.grayscale(raw_img)
        img = ImageOps.autocontrast(img)
        img = img.filter(ImageFilter.SHARPEN)
        img = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)
        return img
    finally:
        # Закрываем исходное сырое изображение, чтобы освободить буфер BytesIO.
        # Возвращаемый `img` — новый объект (копия в градациях серого).
        raw_img.close()


def _extract_from_excel(file_bytes: bytes, file_name: str) -> list[dict[str, Any]]:
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
        df = df.dropna(how="all").dropna(axis=1, how="all")
        results = []

        numeric_cols = df.select_dtypes(include=["number"]).columns
        if not numeric_cols.empty:
            target_col = numeric_cols[0]
            for _, row in df.iterrows():
                raw_amt = float(row[target_col])
                if raw_amt != 0:
                    is_income = raw_amt > 0
                    results.append(
                        {
                            "amount": abs(raw_amt),
                            "category": "Propulsion (Income)"
                            if is_income
                            else "Operations (Rent/Utility)",
                            "description": f"Excel: {str(row.iloc[0])[:30]}",
                            "type": "income" if is_income else "expense",
                        }
                    )
        return results
    except Exception as e:
        logger.error(f"Excel parsing error: {e}")
        return []


def _parse_transactions_from_text(
    text: str, source_name: str, extra_rules: dict[str, str] | None = None
) -> list[dict[str, Any]]:
    clean_text = re.sub(r"[—–−]", "-", text)
    clean_text = clean_text.replace("₽", " ₽ ")

    text_lower = clean_text.lower().replace("ё", "е")
    is_income_context = any(
        w in text_lower
        for w in [
            "поступление",
            "зачисление",
            "перевод доставлен",
            "пополнил",
            "перевод от",
            "входящий",
        ]
    )

    candidates = []
    lines = clean_text.split("\n")

    # Расширенный список ключевых слов, включая частые опечатки Tesseract
    total_keywords = [
        "итог",
        "сумма",
        "к оплате",
        "всего",
        "total",
        "оплата",
        "itog",
        "итоr",
        "htor",
        "итого",
    ]

    for i, line in enumerate(lines):
        line_l = line.lower()

        is_total_line = any(kw in line_l for kw in total_keywords)
        has_date_markers = (
            re.search(r"\d{2}:\d{2}", line)
            or re.search(r"\d{2,4}\s*г\.", line_l)
            or re.search(
                r"(январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр)", line_l
            )
        )

        if has_date_markers and not is_total_line:
            continue

        matches = re.finditer(r"([-+])?\s*(\d+(?:[ \s]*\d+)*(?:[.,]\d{1,2})?)", line)

        for match in matches:
            sign_str = match.group(1)
            num_str = match.group(2)

            val = _safe_parse_amount(num_str)
            if not val or val <= 0 or val > 10000000:
                continue

            prefix = line[: match.start()].lower()
            suffix = line[match.end() :].lower()

            has_currency = bool(re.search(r"^\s*(?:₽|руб|rub|[рРpP]\b)", suffix, re.IGNORECASE))
            has_total_word = any(kw in prefix for kw in total_keywords)

            if not has_total_word and i > 0:
                prev_line = lines[i - 1].lower()
                has_total_word = any(kw in prev_line for kw in total_keywords)

            is_income = is_income_context
            if sign_str == "+":
                is_income = True
            elif sign_str == "-":
                is_income = False

            score = 0
            if has_total_word and has_currency:
                score = 4
            elif has_total_word:
                score = 3
            elif sign_str in ["+", "-"] and has_currency:
                score = 2
            elif has_currency:
                score = 1

            # 🔥 БОНУС ЗА КОПЕЙКИ: Если счет 0, но у числа есть десятые/сотые (129.50) — даем 0.5 балла.
            # Это мгновенно поднимает реальные цены над номерами чеков (918244).
            has_decimal = bool(re.search(r"[.,]\d{1,2}$", num_str))
            if score == 0 and has_decimal:
                score = 0.5  # type: ignore[assignment]

            if (
                score == 0
                and not has_currency
                and val in [2021, 2022, 2023, 2024, 2025, 2026, 2027]
            ):
                continue

            candidates.append((val, is_income, score))

    if not candidates:
        return []

    max_score = max(c[2] for c in candidates)
    score_2_candidates = [c for c in candidates if c[2] == 2]

    if max_score == 2 and len(score_2_candidates) > 1:
        unique_txs = []
        seen = set()
        for val, is_inc, _ in score_2_candidates:
            key = (val, is_inc)
            if key not in seen:
                seen.add(key)
                category = "Propulsion (Income)" if is_inc else "Operations (Rent/Utility)"
                unique_txs.append(
                    {
                        "amount": val,
                        "category": category,
                        "description": f"Выписка: {source_name}"[:255],
                        "type": "income" if is_inc else "expense",
                    }
                )
        return unique_txs

    best_candidates = [c for c in candidates if c[2] == max_score]
    final_amount, final_is_income, _ = max(best_candidates, key=lambda c: c[0])

    category = "Propulsion (Income)" if final_is_income else "Operations (Rent/Utility)"
    merchant_desc = "Документ"

    if not final_is_income:
        rule_match = resolve_merchant_category(text_lower, extra_rules)
        if rule_match is not None:
            category, matched_kw = rule_match
            merchant_desc = matched_kw.capitalize()

    return [
        {
            "amount": final_amount,
            "category": category,
            "description": f"{merchant_desc}: {source_name}"[:255],
            "type": "income" if final_is_income else "expense",
        }
    ]


async def parse_document_bytes(
    content: bytes,
    file_name: str,
    merchant_rules: dict[str, str] | None = None,
) -> list[dict[str, Any]] | None:
    """
    Из сырых байтов документа (PDF / изображение / Excel) → список кандидатов
    транзакций. Транспорт-независимо: используется и Telegram-загрузкой, и
    HTTP-импортом выписок. Тяжёлый разбор — в thread-pool, чтобы не блокировать loop.
    """
    ext = file_name.split(".")[-1].lower()

    if ext in ["xlsx", "xls"]:
        return await asyncio.to_thread(_extract_from_excel, content, file_name)

    text = ""
    if ext == "pdf":
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = "\n".join([p.extract_text() or "" for p in pdf.pages])
        except Exception as e:
            logger.error(f"PDF parsing error: {e}")
            return None
    else:
        processed_img = await asyncio.to_thread(_preprocess_image, content)
        try:
            text = str(
                await asyncio.to_thread(pytesseract.image_to_string, processed_img, lang="rus+eng")
            )
        finally:
            processed_img.close()

    if not text.strip():
        return None

    transactions = await asyncio.to_thread(
        _parse_transactions_from_text, text, file_name, merchant_rules
    )
    return transactions if transactions else None


async def analyze_document_universal(
    bot: Bot,
    file_id: str,
    file_name: str,
    *args: Any,
    merchant_rules: dict[str, str] | None = None,
    **kwargs: Any,
) -> list[dict[str, Any]] | None:
    try:
        file_info = await bot.get_file(file_id)
        if file_info.file_path is None:
            return None
        downloaded = await bot.download_file(file_info.file_path)
        if downloaded is None:
            return None
        content = downloaded.read()
        return await parse_document_bytes(content, file_name, merchant_rules=merchant_rules)

    except Exception as e:
        logger.error(f"Universal Parser Error: {e}")
        return None
