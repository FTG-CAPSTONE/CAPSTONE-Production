from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional


def transform_to_canonical(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        amount = Decimal(str(payload.get("amount_claimed", "0")))
    except Exception:
        amount = Decimal("0")

    incident_date = _parse_date(payload.get("incident_date"))
    reported_date = _parse_date(payload.get("reported_date"))
    if incident_date and reported_date and reported_date < incident_date:
        incident_date, reported_date = reported_date, incident_date

    seg = dict(payload.get("segment_data", {}) or {})
    seg["ob_number"] = payload.get("ob_number")
    seg["provider_name"] = payload.get("provider_name")
    seg["documents"] = list(payload.get("documents", []))
    seg["is_fraud"] = payload.get("is_fraud", False)
    seg["fraud_patterns"] = payload.get("fraud_patterns", [])

    return {
        "case_type": "claim",
        "line_of_business": "motor",
        "claim_type": payload.get("claim_type", "").lower().strip(),
        "external_claim_id": payload.get("claim_id"),
        "policy_id": _parse_uuid(payload.get("_policy_db_id")),
        "claimant_id": _parse_uuid(payload.get("_claimant_db_id")),
        "provider_id": _parse_uuid(payload.get("_provider_db_id")),
        "amount_claimed": amount,
        "amount_approved": None,
        "currency": "KES",
        "incident_date": incident_date,
        "reported_date": reported_date,
        "status": "received",
        "segment_data": seg,
        "submitted_at": datetime.now(timezone.utc),
    }


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _parse_uuid(value: Any) -> Optional[uuid.UUID]:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError):
        return None
