from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.cases.models import Case


def enrich_case(
    case_id: uuid.UUID,
    db: Session,
) -> Dict[str, Any]:
    """
    Compute enrichment fields for a case from existing DB records.
    Returns a dict of enrichment values added to segment_data.

    Called synchronously from the Celery ETL task after the Case is saved.
    """
    case: Optional[Case] = db.get(Case, case_id)
    if not case:
        return {}

    enrichment: Dict[str, Any] = {}

    # ── Prior claims for this claimant ────────────────────────────────────────
    if case.claimant_id:
        prior = _get_prior_claims(db, case.claimant_id, exclude_case_id=case_id)
        enrichment["prior_claims_count"] = len(prior)
        enrichment["prior_claims_total_amount"] = float(
            sum(Decimal(str(p.get("amount", 0))) for p in prior)
        )
        enrichment["prior_motor_claims_count"] = sum(
            1 for p in prior if p.get("lob") == "motor"
        )

    # ── Provider claim history (last 30 and 90 days) ──────────────────────────
    if case.provider_id:
        provider_history = _get_provider_history(db, case.provider_id, exclude_case_id=case_id)
        now = date.today()
        thirty_ago = now - timedelta(days=30)
        ninety_ago = now - timedelta(days=90)

        recent_30 = [p for p in provider_history if p.get("submitted") and p["submitted"] >= thirty_ago]
        recent_90 = [p for p in provider_history if p.get("submitted") and p["submitted"] >= ninety_ago]

        enrichment["provider_claim_count_30d"] = len(recent_30)
        enrichment["provider_claim_amount_30d"] = float(
            sum(Decimal(str(p.get("amount", 0))) for p in recent_30)
        )
        enrichment["provider_claim_count_90d"] = len(recent_90)

    # ── Policy limit context ──────────────────────────────────────────────────
    if case.policy_id:
        policy = _get_policy_info(db, case.policy_id)
        if policy:
            enrichment["sum_insured"] = float(policy.get("sum_insured", 0))
            enrichment["policy_start_date"] = policy.get("start_date").isoformat() if policy.get("start_date") else None
            enrichment["policy_status"] = policy.get("status", "unknown")

    # Merge into segment_data
    seg = dict(case.segment_data or {})
    seg.update(enrichment)

    # Persist enrichment back to case
    case.segment_data = seg
    db.flush()

    return enrichment


def _get_prior_claims(
    db: Session, claimant_id: uuid.UUID, exclude_case_id: uuid.UUID
) -> list:
    from sqlalchemy import select

    rows = db.execute(
        select(Case.amount_claimed, Case.line_of_business, Case.submitted_at)
        .where(Case.claimant_id == claimant_id)
        .where(Case.id != exclude_case_id)
        .where(Case.status.notin_(["received", "processing"]))
    ).all()

    return [
        {
            "amount": float(r.amount_claimed or 0),
            "lob": r.line_of_business,
            "submitted": r.submitted_at.date() if r.submitted_at else None,
        }
        for r in rows
    ]


def _get_provider_history(
    db: Session, provider_id: uuid.UUID, exclude_case_id: uuid.UUID
) -> list:
    from sqlalchemy import select

    rows = db.execute(
        select(Case.amount_claimed, Case.submitted_at)
        .where(Case.provider_id == provider_id)
        .where(Case.id != exclude_case_id)
    ).all()

    return [
        {
            "amount": float(r.amount_claimed or 0),
            "submitted": r.submitted_at.date() if r.submitted_at else None,
        }
        for r in rows
    ]


def _get_policy_info(db: Session, policy_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    from app.cases.models import Policy

    policy = db.get(Policy, policy_id)
    if not policy:
        return None
    return {
        "sum_insured": float(policy.sum_insured or 0),
        "start_date": policy.start_date,
        "status": policy.status,
    }
