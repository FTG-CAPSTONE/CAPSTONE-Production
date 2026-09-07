from __future__ import annotations

from celery.schedules import crontab

from workers.celery_app import celery_app

celery_app.conf.beat_schedule = {
    # ── SLA breach check — every 30 minutes ──────────────────────────────────
    "sla-breach-alert": {
        "task": "app.analytics.tasks.check_sla_breaches",
        "schedule": 1800,
        "options": {"queue": "default"},
    },

    # ── Override rate alert — every 2 hours ───────────────────────────────────
    "override-rate-alert": {
        "task": "app.analytics.tasks.check_override_rate",
        "schedule": 7200,
        "options": {"queue": "default"},
    },

    # ── Queue backlog check — every hour ──────────────────────────────────────
    "queue-backlog-check": {
        "task": "app.analytics.tasks.check_queue_backlog",
        "schedule": crontab(minute=0),
        "options": {"queue": "default"},
    },

    # ── ETL poll fallback — every 5 minutes (prod) ────────────────────────────
    # Uncomment when INSUREMASTER_MODE=live and a Kafka consumer is not set up
    # "poll-insuremaster-new-claims": {
    #     "task": "app.etl.tasks.poll_insuremaster_new_claims",
    #     "schedule": 300,
    # },

    # ── Daily raw_intake purge — 03:00 EAT ───────────────────────────────────
    # "purge-raw-intake": {
    #     "task": "app.ingestion.tasks.purge_old_raw_intake",
    #     "schedule": crontab(hour=3, minute=0),
    # },
}
