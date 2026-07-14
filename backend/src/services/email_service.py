"""
Email Service — отправка писем через SMTP.

Если ET_SMTP_HOST не задан, письмо «отправляется» через структурный лог —
поведение наблюдаемо и не требует внешних сервисов (CI, prod без SMTP).
Локально поднимается MailHog (docker-compose.yml): host=mailhog, UI на :8025.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from src.config import settings

logger = logging.getLogger("email")


class EmailService:
    """Асинхронный фасад отправки писем: SMTP, при его отсутствии — лог."""

    @staticmethod
    async def send_feedback(from_email: str, message: str) -> None:
        """Отправляет письмо обратной связи (лог, если SMTP не настроен)."""
        recipient = settings.feedback_email
        if not settings.smtp_host:
            logger.info(
                "FEEDBACK EMAIL (SMTP не настроен — только лог)\n  to:   %s\n  from: %s\n  body: %s",
                recipient,
                from_email,
                message,
            )
            return

        msg = EmailMessage()
        msg["Subject"] = f"Citrine Vault — обратная связь от {from_email}"
        msg["From"] = settings.smtp_from
        msg["To"] = recipient
        msg["Reply-To"] = from_email
        msg.set_content(message)

        try:
            # smtplib синхронный — уводим в поток, чтобы не блокировать event loop.
            await asyncio.to_thread(EmailService._smtp_send, msg)
            logger.info(
                "FEEDBACK EMAIL sent via SMTP %s:%s → %s",
                settings.smtp_host,
                settings.smtp_port,
                recipient,
            )
        except smtplib.SMTPAuthenticationError:
            # Самая частая причина: обычный пароль Google вместо app password.
            logger.error(
                "SMTP auth failed для %s — нужен app password (16 симв.), "
                "см. https://myaccount.google.com/apppasswords. Письмо не отправлено:\n%s",
                settings.smtp_user,
                message,
            )
        except Exception:
            # Письмо не критично (сообщение уже в БД) — логируем и не роняем фон.
            logger.exception(
                "SMTP send failed (%s:%s); body:\n%s",
                settings.smtp_host,
                settings.smtp_port,
                message,
            )

    @staticmethod
    def _smtp_send(msg: EmailMessage) -> None:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            # Реальные провайдеры (Gmail/Yandex, порт 587) требуют STARTTLS и
            # логин; MailHog — нет. Управляется через ET_SMTP_* в .env.
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
