from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "claimguard",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        # ETL tasks (Phase 2)
        # "app.etl.tasks",
        # ML tasks (Phase 3)
        # "app.ml.tasks",
        # Notification tasks (Phase 4)
        # "app.notifications.tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Nairobi",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.etl.*":           {"queue": "etl"},
        "app.ml.*":            {"queue": "ml"},
        "app.notifications.*": {"queue": "notifications"},
    },
    task_default_queue="default",
)

# ── Auto-discover tasks ───────────────────────────────────────────────────────
celery_app.autodiscover_tasks(["app.etl", "app.ml", "app.notifications"])
