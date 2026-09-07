from __future__ import annotations

from typing import Any, Dict


def _result(code, result, severity, description, triggered_value=None):
    return {"rule_code": code, "result": result, "severity": severity,
            "description": description, "triggered_value": triggered_value}


def rule_amount_over_limit(f: Dict[str, Any]) -> dict:
    t = bool(f.get("amount_over_limit", 0))
    return _result("AMOUNT_OVER_LIMIT",
                   "hard_fail" if t else "pass", "critical" if t else "info",
                   "Claimed amount exceeds policy sum insured",
                   {"amount_claimed": f.get("amount_claimed"), "ratio": f.get("claim_to_limit_ratio")} if t else None)


def rule_missing_mandatory_document(f: Dict[str, Any]) -> dict:
    score = f.get("document_completeness_score", 1.0)
    t = score < 0.60
    return _result("MISSING_MANDATORY_DOCUMENT",
                   "hard_fail" if t else "pass", "critical" if t else "info",
                   "Required document type missing for this claim type",
                   {"document_completeness_score": score} if t else None)


def rule_quick_claim_after_inception(f: Dict[str, Any]) -> dict:
    days = f.get("days_since_inception", 999)
    t = 0 <= days <= 14
    return _result("QUICK_CLAIM_AFTER_INCEPTION",
                   "soft_flag" if t else "pass", "warning" if t else "info",
                   "Claim incident within 14 days of policy start",
                   {"days_since_inception": days} if t else None)


def rule_duplicate_claim_number(f: Dict[str, Any]) -> dict:
    t = bool(f.get("ob_number_duplicate", False))
    return _result("DUPLICATE_CLAIM_NUMBER",
                   "hard_fail" if t else "pass", "critical" if t else "info",
                   "OB number already associated with another claim",
                   {"ob_number_duplicate": t} if t else None)


def rule_provider_billing_spike(f: Dict[str, Any]) -> dict:
    count = f.get("provider_claim_count_30d", 0)
    t = count > 15
    return _result("PROVIDER_BILLING_SPIKE",
                   "soft_flag" if t else "pass", "warning" if t else "info",
                   "Repairer has abnormally high claim volume in last 30 days",
                   {"provider_claim_count_30d": count} if t else None)


def rule_round_number_amount(f: Dict[str, Any]) -> dict:
    t = bool(f.get("is_round_number", False))
    return _result("ROUND_NUMBER_AMOUNT",
                   "soft_flag" if t else "pass", "warning" if t else "info",
                   "Claimed amount is suspiciously round (≥ KES 50,000, divisible by 1,000)",
                   {"amount_claimed": f.get("amount_claimed")} if t else None)


def rule_late_reporting(f: Dict[str, Any]) -> dict:
    days = f.get("days_to_report", 0)
    t = days > 30
    return _result("LATE_REPORTING",
                   "soft_flag" if t else "pass", "warning" if t else "info",
                   "Claim reported more than 30 days after incident",
                   {"days_to_report": days} if t else None)


def rule_repeat_claimant(f: Dict[str, Any]) -> dict:
    count = f.get("prior_claims_count", 0)
    t = count >= 3
    return _result("REPEAT_CLAIMANT",
                   "soft_flag" if t else "pass", "warning" if t else "info",
                   "Policyholder has 3 or more prior claims",
                   {"prior_claims_count": count} if t else None)


MOTOR_RULE_FUNCTIONS = [
    rule_amount_over_limit,
    rule_missing_mandatory_document,
    rule_quick_claim_after_inception,
    rule_duplicate_claim_number,
    rule_provider_billing_spike,
    rule_round_number_amount,
    rule_late_reporting,
    rule_repeat_claimant,
]
