from __future__ import annotations

import math
import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

REQUIRED_DOCS: Dict[str, list] = {
    "own_damage":  ["police_abstract", "repair_quotation", "id_copy"],
    "third_party": ["police_abstract", "id_copy", "third_party_statement"],
    "theft":       ["police_abstract", "logbook", "id_copy"],
    "medical":     ["medical_report", "id_copy"],
    "windscreen":  ["repair_quotation"],
}
CLAIM_TYPE_ENCODING = {"own_damage": 0, "third_party": 1, "theft": 2, "windscreen": 3, "medical": 4}
MOTOR_CLASS_ENCODING = {"comprehensive": 0, "tpft": 1, "third_party": 2}
COUNTY_RISK_TIER = {
    "Nairobi": 5, "Mombasa": 4, "Kiambu": 4, "Nakuru": 3, "Kisumu": 3,
    "Uasin Gishu": 3, "Machakos": 2, "Kakamega": 2, "Meru": 2,
}


def engineer_features(case_id: uuid.UUID, db: Session) -> Dict[str, Any]:
    from app.cases.models import Case, Policy
    from app.ml.models import FeatureSnapshot

    case: Optional[Case] = db.get(Case, case_id)
    if not case:
        return {}

    seg = dict(case.segment_data or {})
    policy: Optional[Policy] = db.get(Policy, case.policy_id) if case.policy_id else None
    today = date.today()

    # Temporal
    if "forced_days_since_inception" in seg:
        days_since_inception = int(seg["forced_days_since_inception"])
    elif policy and case.incident_date:
        days_since_inception = max(0, (case.incident_date - policy.start_date).days)
    else:
        days_since_inception = -1

    if "days_to_report" in seg:
        days_to_report = int(seg["days_to_report"])
    elif case.incident_date and case.reported_date:
        days_to_report = max(0, (case.reported_date - case.incident_date).days)
    else:
        days_to_report = -1

    policy_age_days = (today - policy.start_date).days if policy else -1
    vehicle_age_years = -1
    if policy and policy.vehicle and policy.vehicle.year:
        vehicle_age_years = today.year - policy.vehicle.year

    # Amount
    amount = float(case.amount_claimed or 0)
    sum_insured = float(
        seg.get("sum_insured") or (float(policy.sum_insured) if policy and policy.sum_insured else 0)
    )
    claim_to_limit_ratio = (amount / sum_insured) if sum_insured > 0 else 0.0
    amount_over_limit = amount > sum_insured and sum_insured > 0
    is_round_number = (amount > 0) and (amount % 1000 == 0) and (amount >= 50_000)
    claim_amount_log = math.log1p(amount)

    # Provider
    provider_claim_count_30d = int(seg.get("forced_provider_claim_count_30d") or seg.get("provider_claim_count_30d") or 0)
    provider_claim_count_90d = int(seg.get("provider_claim_count_90d") or 0)
    provider_claim_amount_30d = float(seg.get("forced_provider_claim_amount_30d") or seg.get("provider_claim_amount_30d") or 0.0)

    # Prior claims
    prior_claims_count = int(seg.get("forced_prior_claims_count") or seg.get("prior_claims_count") or 0)
    prior_claims_total_amount = float(seg.get("forced_prior_claims_total") or seg.get("prior_claims_total_amount") or 0.0)
    prior_motor_claims_count = int(seg.get("prior_motor_claims_count") or 0)

    # Documents
    claim_type = (case.claim_type or "own_damage").lower()
    docs_present = set(seg.get("documents") or [])
    required_docs = set(REQUIRED_DOCS.get(claim_type, ["id_copy"]))
    doc_completeness_score = len(docs_present & required_docs) / len(required_docs) if required_docs else 1.0
    has_police_abstract = "police_abstract" in docs_present
    has_valuers_report = "valuers_report" in docs_present
    has_repair_quotation = "repair_quotation" in docs_present

    # Encodings
    claim_type_encoded = CLAIM_TYPE_ENCODING.get(claim_type, 0)
    motor_class_encoded = MOTOR_CLASS_ENCODING.get(
        (policy.motor_class or "comprehensive") if policy else "comprehensive", 0
    )

    # Timing flags
    incident_dt = case.incident_date
    weekend_incident = incident_dt.weekday() >= 5 if incident_dt else False
    hour_of_report = case.submitted_at.hour if case.submitted_at else 12

    # Geography
    county = seg.get("county") or (case.claimant.county if case.claimant else None) or ""
    county_risk_tier = COUNTY_RISK_TIER.get(county, 2)

    # OB duplicate check
    ob_duplicate = bool(seg.get("ob_duplicate", False))
    if not ob_duplicate and seg.get("ob_number"):
        ob_duplicate = _check_ob_duplicate(db, seg["ob_number"], case_id)

    # Complexity score (rule-based)
    complexity = 0
    if amount > 300_000: complexity += 30
    if len(seg.get("documents", [])) > 4: complexity += 15
    if claim_type == "third_party": complexity += 25
    if policy and policy.end_date and (policy.end_date - today).days < 30: complexity += 10
    if prior_claims_count >= 3: complexity += 10
    complexity_score = min(100, complexity)

    features = {
        "days_since_inception": days_since_inception,
        "days_to_report": days_to_report,
        "policy_age_days": policy_age_days,
        "vehicle_age_years": vehicle_age_years,
        "weekend_incident": int(weekend_incident),
        "hour_of_report": hour_of_report,
        "amount_claimed": amount,
        "claim_to_limit_ratio": round(claim_to_limit_ratio, 4),
        "amount_over_limit": int(amount_over_limit),
        "is_round_number": int(is_round_number),
        "claim_amount_log": round(claim_amount_log, 4),
        "provider_claim_count_30d": provider_claim_count_30d,
        "provider_claim_count_90d": provider_claim_count_90d,
        "provider_claim_amount_30d": round(provider_claim_amount_30d, 2),
        "prior_claims_count": prior_claims_count,
        "prior_claims_total_amount": round(prior_claims_total_amount, 2),
        "prior_motor_claims_count": prior_motor_claims_count,
        "document_completeness_score": round(doc_completeness_score, 4),
        "has_police_abstract": int(has_police_abstract),
        "has_valuers_report": int(has_valuers_report),
        "has_repair_quotation": int(has_repair_quotation),
        "claim_type_encoded": claim_type_encoded,
        "motor_class_encoded": motor_class_encoded,
        "county_risk_tier": county_risk_tier,
        "ob_number_duplicate": int(ob_duplicate),
    }

    snap = FeatureSnapshot(case_id=case_id, features=features)
    db.add(snap)
    db.flush()

    case.complexity_score = Decimal(str(complexity_score))
    db.flush()

    return features


def _check_ob_duplicate(db: Session, ob_number: str, exclude_case_id: uuid.UUID) -> bool:
    from sqlalchemy import select
    from app.cases.models import Case
    rows = db.execute(
        select(Case.id)
        .where(Case.segment_data["ob_number"].as_string() == ob_number)
        .where(Case.id != exclude_case_id)
        .limit(1)
    ).fetchall()
    return len(rows) > 0
