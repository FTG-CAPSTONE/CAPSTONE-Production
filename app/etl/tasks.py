from __future__ import annotations

"""
ETL pipeline — can run as a Celery task (async with broker)
OR synchronously via run_etl_sync() when broker is unavailable (dev).

Pipeline: validate → transform → enrich → features → quality gate
          → rules → ML scoring → route → HITL queue if needed
"""

import uuid
from datetime import datetime, timezone

from app.core.db import SyncSessionLocal

# ── Routing thresholds ────────────────────────────────────────────────────────
# Cases with fraud_score < LOW_RISK_THRESHOLD and confidence >= MIN_CONFIDENCE
# and no soft flags can be auto-approved when a champion model exists.
LOW_RISK_THRESHOLD = 35.0       # fraud score (0–100)
MIN_CONFIDENCE     = 0.72       # model confidence (0–1)


def run_etl_sync(intake_id: str) -> dict:
    """
    Run the full ETL pipeline synchronously.
    Used as fallback when Celery broker is unavailable.
    """
    import app.users.models      # noqa: F401
    import app.cases.models      # noqa: F401
    import app.ingestion.models  # noqa: F401
    import app.rules.models      # noqa: F401
    import app.ml.models         # noqa: F401
    import app.hitl.models       # noqa: F401
    import app.quality.models    # noqa: F401

    db = SyncSessionLocal()
    try:
        result = _execute_pipeline(intake_id, db)
        db.commit()
        return result
    except Exception as exc:
        db.rollback()
        _mark_failed(intake_id, str(exc), db)
        db.commit()
        raise
    finally:
        db.close()


def _execute_pipeline(intake_id: str, db) -> dict:
    from app.cases.models import Case, CaseEvent
    from app.etl.enrich import enrich_case
    from app.etl.features import engineer_features
    from app.etl.quality import log_quality_events
    from app.etl.transform import transform_to_canonical
    from app.etl.validate import validate_raw_payload
    from app.ingestion.models import RawIntake
    from app.rules.engine import evaluate_rules_sync
    from sqlalchemy import select

    # ── 1. Load raw intake ────────────────────────────────────────────────────
    uid = uuid.UUID(intake_id)
    intake: RawIntake | None = db.get(RawIntake, uid)
    if not intake:
        raise ValueError(f"RawIntake {intake_id} not found")

    if intake.etl_status == "done":
        return {"status": "already_done", "intake_id": intake_id}

    intake.etl_status = "processing"
    db.flush()

    payload = dict(intake.raw_payload)

    # ── 2. Validate ───────────────────────────────────────────────────────────
    validation = validate_raw_payload(payload)

    if validation.decision == "rejected":
        log_quality_events(db, None, None, validation)
        intake.etl_status = "failed"
        intake.error_message = f"Rejected: {[i['issue_type'] for i in validation.issues]}"
        db.flush()
        return {"status": "rejected", "intake_id": intake_id, "issues": validation.issues}

    # ── 3. Idempotency check ──────────────────────────────────────────────────
    existing = db.execute(
        select(Case).where(Case.external_claim_id == payload.get("claim_id"))
    ).scalar_one_or_none()

    if existing:
        intake.etl_status = "done"
        db.flush()
        return {"status": "duplicate", "case_id": str(existing.id), "intake_id": intake_id}

    # ── 4. Transform → canonical Case ─────────────────────────────────────────
    case = Case(**transform_to_canonical(payload))
    db.add(case)
    db.flush()

    if validation.issues:
        log_quality_events(db, case.id, None, validation)

    _write_event(db, case.id, "ingested", "system", {
        "decision": validation.decision,
        "source": intake.source,
        "external_ref": intake.external_ref,
    })

    # ── 5. Enrich ─────────────────────────────────────────────────────────────
    enrichment = enrich_case(case.id, db)
    _write_event(db, case.id, "enriched", "system", {
        "prior_claims": enrichment.get("prior_claims_count", 0),
        "provider_count_30d": enrichment.get("provider_claim_count_30d", 0),
    })

    # ── 6. Feature engineering ────────────────────────────────────────────────
    features = engineer_features(case.id, db)
    _write_event(db, case.id, "featured", "system", {
        "feature_count": len(features),
        "complexity_score": float(case.complexity_score or 0),
    })

    # ── 7. Rules engine ───────────────────────────────────────────────────────
    rule_results = evaluate_rules_sync(case.id, features, db)
    has_hard_fail = any(r["result"] == "hard_fail" for r in rule_results)
    has_soft_flag = any(r["result"] == "soft_flag" for r in rule_results)

    _write_event(db, case.id, "rules_evaluated", "system", {
        "total": len(rule_results),
        "hard_fails": sum(1 for r in rule_results if r["result"] == "hard_fail"),
        "soft_flags": sum(1 for r in rule_results if r["result"] == "soft_flag"),
    })

    # Hard-fail: auto-reject immediately, skip ML
    if has_hard_fail:
        case.status = "auto_rejected"
        _write_event(db, case.id, "routed", "system", {
            "status": "auto_rejected",
            "reason": "hard_rule_fail",
            "has_hard_fail": True,
            "has_soft_flag": has_soft_flag,
        })
        intake.etl_status = "done"
        db.flush()
        return {
            "status": "processed",
            "case_id": str(case.id),
            "case_status": "auto_rejected",
            "intake_id": intake_id,
            "hard_fails": sum(1 for r in rule_results if r["result"] == "hard_fail"),
            "soft_flags": sum(1 for r in rule_results if r["result"] == "soft_flag"),
        }

    # ── 8. ML Scoring ─────────────────────────────────────────────────────────
    from app.ml.scorer import score_case as ml_score_case

    ml_result = ml_score_case(case.id, features, db)

    fraud_score = None
    confidence = None
    fraud_band = None
    routing_reason = "no_champion_model"

    if ml_result and "error" not in ml_result:
        fraud_score = ml_result["score"]
        confidence  = ml_result["confidence"]
        fraud_band  = ml_result["band"]

        from decimal import Decimal
        case.fraud_score  = Decimal(str(fraud_score))
        case.confidence   = Decimal(str(confidence))
        case.fraud_band   = fraud_band
        db.flush()

        _write_event(db, case.id, "scored", "system", {
            "fraud_score": fraud_score,
            "fraud_band": fraud_band,
            "confidence": confidence,
            "model_version": ml_result.get("model_version"),
            "shap_top_feature": (
                ml_result["shap_values"][0]["feature"]
                if ml_result.get("shap_values") else None
            ),
        })

    # ── 9. Routing decision ───────────────────────────────────────────────────
    if ml_result is None:
        # No champion model — everything goes to HITL
        case.status = "in_review"
        routing_reason = "no_champion_model"

    elif "error" in ml_result:
        # Model load failed — route to HITL, don't crash
        case.status = "in_review"
        routing_reason = "ml_error"

    elif (
        fraud_score < LOW_RISK_THRESHOLD
        and confidence >= MIN_CONFIDENCE
        and not has_soft_flag
    ):
        # Clean case: low fraud risk, high confidence, no flags → auto-approve
        case.status = "auto_approved"
        routing_reason = "low_risk_high_confidence"

    else:
        # High risk, low confidence, or soft flags → human review
        case.status = "in_review"
        if fraud_score is not None and fraud_score >= 80:
            routing_reason = "high_fraud_score"
        elif has_soft_flag:
            routing_reason = "rule_soft_flag"
        elif confidence is not None and confidence < MIN_CONFIDENCE:
            routing_reason = "low_confidence"
        else:
            routing_reason = "medium_fraud_score"

    _write_event(db, case.id, "routed", "system", {
        "status": case.status,
        "reason": routing_reason,
        "has_soft_flag": has_soft_flag,
        "fraud_score": fraud_score,
        "confidence": confidence,
    })

    # ── 10. HITL queue entry ───────────────────────────────────────────────────
    if case.status == "in_review":
        from app.hitl.models import ReviewQueueItem
        from decimal import Decimal

        # Priority = fraud_score × (amount / 10K) × (1 / confidence)
        amount_factor = float(case.amount_claimed or 0) / 10_000
        conf_factor   = max(float(confidence or 0.5), 0.01)
        score_factor  = float(fraud_score or 50)
        priority = Decimal(str(round(score_factor * amount_factor / conf_factor, 2)))

        queue_item = ReviewQueueItem(
            case_id=case.id,
            priority_score=priority,
            reason=routing_reason,
            status="pending",
        )
        db.add(queue_item)
        db.flush()

    # ── 11. Done ──────────────────────────────────────────────────────────────
    intake.etl_status = "done"
    db.flush()

    return {
        "status": "processed",
        "case_id": str(case.id),
        "case_status": case.status,
        "intake_id": intake_id,
        "fraud_score": fraud_score,
        "fraud_band": fraud_band,
        "confidence": confidence,
        "routing_reason": routing_reason,
        "hard_fails": 0,
        "soft_flags": sum(1 for r in rule_results if r["result"] == "soft_flag"),
    }


def _write_event(db, case_id: uuid.UUID, event_type: str, actor: str, payload: dict) -> None:
    from app.cases.models import CaseEvent
    event = CaseEvent(
        case_id=case_id,
        event_type=event_type,
        actor=actor,
        payload=payload,
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    db.flush()


def _mark_failed(intake_id: str, error: str, db) -> None:
    from app.ingestion.models import RawIntake
    try:
        intake = db.get(RawIntake, uuid.UUID(intake_id))
        if intake:
            intake.etl_status = "failed"
            intake.error_message = error[:2000]
            db.flush()
    except Exception:
        pass


# ── Celery task wrapper ───────────────────────────────────────────────────────

try:
    from workers.celery_app import celery_app

    @celery_app.task(name="app.etl.tasks.process_intake", bind=True, max_retries=3)
    def process_intake(self, intake_id: str) -> dict:
        try:
            return run_etl_sync(intake_id)
        except Exception as exc:
            raise self.retry(exc=exc, countdown=2 ** self.request.retries)

except ImportError:
    class process_intake:  # type: ignore[no-redef]
        @staticmethod
        def delay(intake_id: str) -> None:
            run_etl_sync(intake_id)
