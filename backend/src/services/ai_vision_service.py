import asyncio
import contextlib
import io
import logging
import re
from typing import Any

import pytesseract
from aiogram import Bot
from PIL import Image

logger = logging.getLogger(__name__)

# Словарь для поиска категорий по ключевым словам из чека
MERCHANT_TO_CATEGORY = {
    "такси": "Operations (Rent/Utility)",
    "яндекс": "Operations (Rent/Utility)",
    "пятерочка": "Operations (Rent/Utility)",
    "магнит": "Operations (Rent/Utility)",
    "вкусвилл": "Operations (Rent/Utility)",
    "перекресток": "Operations (Rent/Utility)",
    "кофе": "Leisure (Lifestyle)",
    "кафе": "Leisure (Lifestyle)",
    "ресторан": "Leisure (Lifestyle)",
    "аптека": "Wellness (Health)",
}


def _process_image_sync(image_bytes: bytes) -> str:
    """Синхронная блокирующая функция обработки картинки через Tesseract OCR."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        # Переводим в Ч/Б для повышения точности OCR
        image = image.convert("L")
        # Ищем текст на русском и английском
        text = pytesseract.image_to_string(image, lang='rus+eng')
        return str(text)
    except Exception as e:
        logger.error(f"Tesseract Error: {e}")
        return ""


# ОБРАТИ ВНИМАНИЕ: возвращаемый тип изменен на list[dict[str, Any]]
async def analyze_receipt_with_ai(
    bot: Bot, file_id: str, available_categories: list[str]
) -> list[dict[str, Any]] | None:
    """
    Распознавание чека с помощью Tesseract OCR и RegEx.
    Поддерживает как классические магазинные чеки, так и банковские скриншоты с +/-.
    """
    try:
        # 1. Скачиваем фото из Telegram
        file_info = await bot.get_file(file_id)
        downloaded_file = await bot.download_file(file_info.file_path)
        image_bytes = downloaded_file.read()

        # 2. Выполняем OCR в отдельном потоке
        text = await asyncio.to_thread(_process_image_sync, image_bytes)

        if not text.strip():
            logger.warning("OCR не нашел текст на фото.")
            return None

        transactions = []
        text_lower = text.lower()

        # =====================================================================
        # СЦЕНАРИЙ 1: БАНКОВСКАЯ ВЫПИСКА (+3000, -500.50)
        # =====================================================================
        # Ищем явно указанные плюсы или минусы перед цифрами, учитывая пробелы в тысячах
        bank_pattern = r"([+-])\s*(\d+(?:[ \s]\d+)*(?:[.,]\d{1,2})?)"
        bank_matches = re.findall(bank_pattern, text)

        if bank_matches:
            for sign, amount_str in bank_matches:
                clean_num = amount_str.replace(" ", "").replace(",", ".")
                try:
                    amount = float(clean_num)
                    if amount > 0:
                        is_income = sign == "+"
                        transactions.append(
                            {
                                "amount": amount,
                                "category": "Propulsion (Income)"
                                if is_income
                                else "Operations (Rent/Utility)",
                                "description": "Пополнение" if is_income else "Списание",
                                "type": "income" if is_income else "expense",
                            }
                        )
                except ValueError:
                    continue

            # Если нашли банковские операции, сразу возвращаем их
            if transactions:
                return transactions

        # =====================================================================
        # СЦЕНАРИЙ 2: КЛАССИЧЕСКИЙ ЧЕК (ИТОГ: 1 500 или 44 444.00)
        # =====================================================================
        amount = 0.0
        # Ищем по строкам, так как сумма обычно в конце строки
        for line in text.split("\n"):
            line_l = line.lower()
            if any(keyword in line_l for keyword in ["итог", "сумма", "к оплате", "всего"]):
                # Поддерживаем суммы с пробелами (44 444) и без обязательных копеек
                nums = re.findall(r"\d+(?:[ \s]\d+)*(?:[.,]\d{1,2})?", line)
                if nums:
                    clean_num = nums[-1].replace(" ", "").replace(",", ".")
                    try:
                        parsed_amount = float(clean_num)
                        if parsed_amount > amount:
                            amount = parsed_amount
                    except ValueError:
                        pass

        # Fallback: просто ищем самую большую цену на чеке
        if amount <= 0:
            # Тут требуем копейки \d{2}, чтобы случайно не схватить номер телефона или ИНН
            all_prices = re.findall(r"\b\d+(?:[ \s]\d+)*[.,]\d{2}\b", text)
            if all_prices:
                with contextlib.suppress(ValueError):
                    amount = max([float(p.replace(" ", "").replace(",", ".")) for p in all_prices])

        if amount <= 0:
            return None

        # 4. ПОИСК КАТЕГОРИИ
        category = "Operations (Rent/Utility)"  # Категория по умолчанию
        merchant_desc = "Чек (Распознано)"

        for keyword, cat_id in MERCHANT_TO_CATEGORY.items():
            if keyword in text_lower:
                category = cat_id
                merchant_desc = keyword.capitalize()
                break

        # Возвращаем ОДИН чек внутри списка, чтобы интерфейс всегда работал с list
        return [
            {
                "amount": amount,
                "category": category,
                "description": merchant_desc,
                "type": "expense",
            }
        ]

    except Exception as e:
        logger.error(f"DIY OCR Pipeline Error: {e}")
        return None
