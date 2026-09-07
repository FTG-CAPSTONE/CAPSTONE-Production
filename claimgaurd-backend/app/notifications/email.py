from __future__ import annotations

import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import structlog

from app.core.config import settings

logger = structlog.get_logger()


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str = "",
    from_email: Optional[str] = None,
) -> bool:
    """
    Send an email via SMTP.
    Returns True on success, False on failure (never raises — notification
    failures must not interrupt the main application flow).
    """
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        logger.info("email.skipped", reason="SMTP not configured", to=to, subject=subject)
        return False

    sender = from_email or settings.NOTIFICATION_FROM_EMAIL

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to

    if text:
        msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(sender, to, msg.as_string())
        logger.info("email.sent", to=to, subject=subject)
        return True
    except Exception as exc:
        logger.warning("email.failed", to=to, subject=subject, error=str(exc))
        return False


def send_email_to_admins(subject: str, html: str, text: str = "") -> None:
    """
    Send to the configured admin notification email.
    Falls back gracefully if not configured.
    """
    admin_email = settings.NOTIFICATION_FROM_EMAIL
    if admin_email:
        send_email(admin_email, subject, html, text)
