from __future__ import annotations

"""
Celery background tasks for analytics, SLA monitoring, and alert evaluation.

These tasks are scheduled in workers/beat_schedule.py and can also be
triggered manually via the admin API.
"""

import structlog
from datetime import datetime, timedelta, timezone

logger = structlog.get_logger()

# ── SLA breach check ──────────────────────────────────────────────────────────

def check_sla_breaches_sync() -> dict:
    """
    Find all open cases approaching or past the IRA 90-day statutory deadline.

    Tiers:
      - amber (days_open >= 60): warn admin
      - red   (days_open >= 80): urgent alert + case_event
      - breach(days_open >= 90): SLA breach event + notify admin

    Returns a summary dict for logging / API response.
    """
    import app.users.models   # noqa: F401
    import app.cases.models   # noqa: F401
    import app.ml.models      # noqa: F401
    import app.hitl.models    # noqa: F401
    import app.quality.models # noqa: F401
    import app.rules.models   # noqa: F401

    from app.core.db import SyncSessionLocal
    from app.cases.models import Case, CaseEvent
    from sqlalchemy import select

    db = SyncSessionLocal()
    now = datetime.now(timezone.utc)
    OPEN_STATUSES = ("received", "processing", "in_review")

    try:
        open_cases = db.execute(
            select(Case)
            .where(Case.status.in_(OPEN_STATUSES))
            .where(Case.closed_at.is_(None))
        ).scalars().all()

        amber_count = 0
        red_count = 0
        breach_count = 0

        for case in open_cases:
            submitted = case.submitted_at
            if submitted.tzinfo is None:
                submitted = submitted.replace(tzinfo=timezone.utc)
            days_open = (now - submitted).days
            days_remaining = 90 - days_open

            if days_open < 60:
                continue

            tier = "breach" if days_open >= 90 else ("red" if days_open >= 80 else "amber")

            # Write a case_event for red + breach (not amber — would be too noisy)
            if tier in ("red", "breach"):
                # Check if we already wrote a breach event today to avoid duplicate alerts
                existing_today = db.execute(
                    select(CaseEvent)
                    .where(CaseEvent.case_id == case.id)
                    .where(CaseEvent.event_type == f"sla_{tier}")
                    .where(CaseEvent.occurred_at >= now.replace(hour=0, minute=0, second=0, microsecond=0))
                ).scalar_one_or_none()

                if not existing_today:
                    event = CaseEvent(
                        case_id=case.id,
                        event_type=f"sla_{tier}",
                        actor="system",
                        payload={
                            "days_open": days_open,
                            "days_remaining": days_remaining,
                            "tier": tier,
                        },
                        occurred_at=now,
                    )
                    db.add(event)

                    # Notify admin
                    from app.notifications.tasks import dispatch_sla_warning
                    try:
                        dispatch_sla_warning(
                            case_id=str(case.id),
                            claim_ref=case.external_claim_id or str(case.id)[:8],
                            days_open=days_open,
                            days_remaining=max(0, days_remaining),
                        )
                    except Exception as exc:
                        logger.warning("sla.notify_failed", case_id=str(case.id), error=str(exc))

            if tier == "amber":
                amber_count += 1
            elif tier == "red":
                red_count += 1
            else:
                breach_count += 1

        db.commit()
        result = {
            "checked": len(open_cases),
            "amber": amber_count,
            "red": red_count,
            "breach": breach_count,
            "run_at": now.isoformat(),
        }
        logger.info("sla.check_complete", **result)
        return result

    except Exception as exc:
        db.rollback()
        logger.error("sla.check_failed", error=str(exc))
        raise
    finally:
        db.close()


# ── Override rate alert ────────────────────────────────────────────────────────

OVERRIDE_RATE_THRESHOLD = 0.15  # 15% — fire alert above this


def check_override_rate_sync() -> dict:
    """
    Calculate the reviewer override rate over the last 30 days.
    Fire a notification if it exceeds OVERRIDE_RATE_THRESHOLD.
    """
    import app.users.models, app.cases.models, app.ml.models
    import app.hitl.models, app.quality.models, app.rules.models

    from app.core.db import SyncSessionLocal
    from app.hitl.models import ReviewDecision
    from sqlalchemy import func, select

    db = SyncSessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(days=30)

        total_res = db.execute(
            select(func.count(ReviewDecision.id)).where(ReviewDecision.decided_at >= since)
        )
        total = total_res.scalar_one() or 0

        override_res = db.execute(
            select(func.count(ReviewDecision.id))
            .where(ReviewDecision.decided_at >= since)
            .where(ReviewDecision.is_override == True)  # noqa: E712
        )
        overrides = override_res.scalar_one() or 0

        override_rate = round(overrides / total, 4) if total > 0 else 0.0

        if override_rate > OVERRIDE_RATE_THRESHOLD and total >= 5:
            from app.notifications.tasks import dispatch_override_rate_alert
            try:
                dispatch_override_rate_alert(override_rate, OVERRIDE_RATE_THRESHOLD)
                logger.warning("override_rate.alert_fired",
                               rate=override_rate, threshold=OVERRIDE_RATE_THRESHOLD)
            except Exception as exc:
                logger.warning("override_rate.notify_failed", error=str(exc))

        return {
            "total_decisions_30d": total,
            "overrides_30d": overrides,
            "override_rate": override_rate,
            "alert_fired": override_rate > OVERRIDE_RATE_THRESHOLD and total >= 5,
        }
    finally:
        db.close()


# ── Queue backlog check ────────────────────────────────────────────────────────

QUEUE_BACKLOG_THRESHOLD = 50


def check_queue_backlog_sync() -> dict:
    """Alert when more than QUEUE_BACKLOG_THRESHOLD cases are pending review."""
    import app.users.models, app.cases.models, app.hitl.models
    import app.quality.models, app.rules.models, app.ml.models

    from app.core.db import SyncSessionLocal
    from app.hitl.models import ReviewQueueItem
    from app.cases.models import Case
    from sqlalchemy import func, select

    db = SyncSessionLocal()
    try:
        now = datetime.now(timezone.utc)

        total_res = db.execute(
            select(func.count(ReviewQueueItem.id))
            .where(ReviewQueueItem.status == "pending")
        )
        queue_size = total_res.scalar_one() or 0

        if queue_size >= QUEUE_BACKLOG_THRESHOLD:
            # Find oldest pending case age
            oldest_res = db.execute(
                select(ReviewQueueItem.created_at)
                .where(ReviewQueueItem.status == "pending")
                .order_by(ReviewQueueItem.created_at.asc())
                .limit(1)
            )
            oldest_row = oldest_res.scalar_one_or_none()
            oldest_created = oldest_row if oldest_row else now
            if oldest_created.tzinfo is None:
                oldest_created = oldest_created.replace(tzinfo=timezone.utc)
            oldest_days = (now - oldest_created).days

            from app.notifications.tasks import dispatch_queue_backlog_alert
            try:
                dispatch_queue_backlog_alert(queue_size, oldest_days)
            except Exception as exc:
                logger.warning("queue_backlog.notify_failed", error=str(exc))

        return {
            "queue_size": queue_size,
            "alert_fired": queue_size >= QUEUE_BACKLOG_THRESHOLD,
        }
    finally:
        db.close()


# ── Celery task wrappers ───────────────────────────────────────────────────────

try:
    from workers.celery_app import celery_app

    @celery_app.task(name="app.analytics.tasks.check_sla_breaches", ignore_result=False)
    def check_sla_breaches() -> dict:
        return check_sla_breaches_sync()

    @celery_app.task(name="app.analytics.tasks.check_override_rate", ignore_result=False)
    def check_override_rate() -> dict:
        return check_override_rate_sync()

    @celery_app.task(name="app.analytics.tasks.check_queue_backlog", ignore_result=False)
    def check_queue_backlog() -> dict:
        return check_queue_backlog_sync()

except ImportError:
    pass
