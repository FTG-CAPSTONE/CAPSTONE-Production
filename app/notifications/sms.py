from __future__ import annotations

import structlog

from app.core.config import settings

logger = structlog.get_logger()


def send_sms(to: str, message: str) -> bool:
    """
    Send SMS via Africa's Talking.
    Returns True on success, False on failure (never raises).

    The message is truncated to 160 characters (single SMS segment).
    Multi-segment messages increase cost — keep templates concise.
    """
    if not settings.AT_API_KEY or settings.AT_API_KEY == "changeme":
        logger.info("sms.skipped", reason="Africa's Talking not configured", to=to)
        return False

    message = message[:160]

    try:
        import africastalking
        africastalking.initialize(
            username=settings.AT_USERNAME,
            api_key=settings.AT_API_KEY,
        )
        sms = africastalking.SMS
        response = sms.send(message, [to], sender_id=settings.AT_SENDER_ID)
        recipients = response.get("SMSMessageData", {}).get("Recipients", [])
        if recipients and recipients[0].get("status") == "Success":
            logger.info("sms.sent", to=to, cost=recipients[0].get("cost"))
            return True
        logger.warning("sms.failed", to=to, response=response)
        return False
    except ImportError:
        logger.warning("sms.skipped", reason="africastalking package not installed")
        return False
    except Exception as exc:
        logger.warning("sms.failed", to=to, error=str(exc))
        return False
