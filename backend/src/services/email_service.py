"""
Email Service — заглушка доставки писем.

SMTP пока не настроен: письмо «отправляется» через структурный лог, чтобы
поведение было наблюдаемым и легко заменялось на реальный транспорт
(aiosmtplib и т.п.) позже — сигнатуры менять не придётся.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("email")

# Куда уходит обратная связь (совпадает с адресом в FeedbackWidget на фронте).
FEEDBACK_RECIPIENT = "ninjacodex333@gmail.com"


class EmailService:
    """Асинхронный фасад отправки писем. Пока логирует вместо реального SMTP."""

    @staticmethod
    async def send_feedback(from_email: str, message: str) -> None:
        """«Отправляет» письмо обратной связи (лог до настройки SMTP)."""
        logger.info(
            "FEEDBACK EMAIL\n  to:   %s\n  from: %s\n  body: %s",
            FEEDBACK_RECIPIENT,
            from_email,
            message,
        )
