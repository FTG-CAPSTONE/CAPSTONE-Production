from __future__ import annotations

"""
Notification Celery tasks.

All tasks are fire-and-forget — failures are logged but never re-raised
so they don't interrupt the main ETL or HITL pipeline.
"""

import structlog

logger = structlog.get_logger()


def dispatch_decision_notification(
    case_id: str,
    claim_ref: str,
    decision: str,
    amount: str,
    claimant_phone: str | None,
    claimant_email: str | None,
) -> None:
    """
    Send email + SMS notification when a case decision is recorded.
    Called from app/hitl or app/cases decision endpoint.
    """
    from app.notifications.email import send_email
    from app.notifications.sms import send_sms
    from app.notifications.templates import email_decision_made, sms_decision_made

    tmpl = email_decision_made(case_id, decision, claim_ref, amount)
    if claimant_email:
        send_email(claimant_email, tmpl["subject"], tmpl["html"], tmpl["text"])

    if claimant_phone:
        send_sms(claimant_phone, sms_decision_made(claim_ref, decision))


def dispatch_fraud_alert(
    case_id: str,
    claim_ref: str,
    fraud_score: float,
    band: str,
    admin_email: str | None = None,
) -> None:
    """Notify admin when a case is scored Critical or High."""
    from app.notifications.email import send_email_to_admins
    from app.notifications.templates import email_fraud_alert

    tmpl = email_fraud_alert(case_id, claim_ref, fraud_score, band)
    send_email_to_admins(tmpl["subject"], tmpl["html"], tmpl["text"])


def dispatch_sla_warning(
    case_id: str,
    claim_ref: str,
    days_open: int,
    days_remaining: int,
    claimant_phone: str | None = None,
) -> None:
    """Notify admin (and optionally claimant) of approaching SLA deadline."""
    from app.notifications.email import send_email_to_admins
    from app.notifications.sms import send_sms
    from app.notifications.templates import email_sla_breach_warning, sms_sla_warning

    tmpl = email_sla_breach_warning(case_id, claim_ref, days_open, days_remaining)
    send_email_to_admins(tmpl["subject"], tmpl["html"], tmpl["text"])

    if claimant_phone and days_remaining <= 14:
        send_sms(claimant_phone, sms_sla_warning(claim_ref, days_remaining))


def dispatch_queue_backlog_alert(queue_size: int, oldest_days: int) -> None:
    from app.notifications.email import send_email_to_admins
    from app.notifications.templates import email_queue_backlog

    tmpl = email_queue_backlog(queue_size, oldest_days)
    send_email_to_admins(tmpl["subject"], tmpl["html"], tmpl["text"])


def dispatch_override_rate_alert(override_rate: float, threshold: float) -> None:
    from app.notifications.email import send_email_to_admins
    from app.notifications.templates import email_override_rate_alert

    tmpl = email_override_rate_alert(override_rate, threshold)
    send_email_to_admins(tmpl["subject"], tmpl["html"], tmpl["text"])


# ── Celery task wrappers (async dispatch when broker available) ────────────────

try:
    from workers.celery_app import celery_app

    @celery_app.task(name="app.notifications.tasks.send_decision_notification", ignore_result=True)
    def send_decision_notification(
        case_id: str, claim_ref: str, decision: str, amount: str,
        claimant_phone: str | None, claimant_email: str | None,
    ) -> None:
        dispatch_decision_notification(
            case_id, claim_ref, decision, amount, claimant_phone, claimant_email
        )

    @celery_app.task(name="app.notifications.tasks.send_fraud_alert", ignore_result=True)
    def send_fraud_alert(
        case_id: str, claim_ref: str, fraud_score: float, band: str
    ) -> None:
        dispatch_fraud_alert(case_id, claim_ref, fraud_score, band)

except ImportError:
    # Celery not available — tasks run synchronously inline
    pass
