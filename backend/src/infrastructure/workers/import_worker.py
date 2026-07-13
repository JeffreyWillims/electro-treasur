"""
arq Worker — тяжёлый разбор загруженных выписок (PDF/изображение/Excel).

Разбор офлоадится в воркер, чтобы не держать HTTP-воркеры на медленном
pdfplumber/OCR. Результат (кандидаты транзакций) читается через polling джобы;
пользователь подтверждает импорт отдельным эндпоинтом. Без LLM — эвристический
парсер `ai_vision_service`.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

from src.services.ai_vision_service import parse_document_bytes

logger = logging.getLogger(__name__)


async def parse_statement(
    ctx: dict[str, Any], user_id: int, content_b64: str, file_name: str
) -> dict[str, Any]:
    """arq task: разобрать выписку → кандидаты транзакций (превью, без записи в БД)."""
    content = base64.b64decode(content_b64)
    candidates = await parse_document_bytes(content, file_name) or []
    logger.info(
        "Parsed statement user=%d file=%s candidates=%d", user_id, file_name, len(candidates)
    )
    return {"file_name": file_name, "candidates": candidates, "count": len(candidates)}
