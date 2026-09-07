from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List

VALID_CLAIM_TYPES = {"own_damage", "third_party", "theft", "windscreen", "medical"}


@dataclass
class ValidationResult:
    decision: str = "trusted"
    issues: List[Dict[str, Any]] = field(default_factory=list)

    def add_issue(self, field_name: str, issue_type: str, raw_value: Any, corrected: bool = False) -> None:
        self.issues.append({"field": field_name, "issue_type": issue_type, "raw_value": str(raw_value)[:500]})
        if corrected:
            if self.decision == "trusted":
                self.decision = "corrected"
        else:
            self.decision = "rejected"


def validate_raw_payload(payload: Dict[str, Any]) -> ValidationResult:
    result = ValidationResult()

    for req in ("claim_id", "policy_id", "claimant_id", "claim_type", "amount_claimed"):
        if not payload.get(req):
            result.add_issue(req, "missing_required", None, corrected=False)

    if result.decision == "rejected":
        return result

    ct = payload.get("claim_type", "").lower().strip()
    if ct not in VALID_CLAIM_TYPES:
        result.add_issue("claim_type", "invalid_enum", ct, corrected=False)
        return result

    try:
        amount = Decimal(str(payload["amount_claimed"]))
        if amount <= 0:
            result.add_issue("amount_claimed", "non_positive_amount", amount, corrected=False)
            return result
        if amount > Decimal("50000000"):
            result.add_issue("amount_claimed", "implausibly_large", amount, corrected=True)
    except InvalidOperation:
        result.add_issue("amount_claimed", "invalid_decimal", payload["amount_claimed"], corrected=False)
        return result

    incident_date = _parse_date(payload.get("incident_date"), "incident_date", result)
    reported_date = _parse_date(payload.get("reported_date"), "reported_date", result)

    if incident_date and reported_date and reported_date < incident_date:
        result.add_issue("reported_date", "reported_before_incident",
                         f"{reported_date} < {incident_date}", corrected=True)

    if incident_date and incident_date > date.today():
        result.add_issue("incident_date", "future_incident_date", incident_date, corrected=False)
        return result

    docs = payload.get("documents", [])
    if not isinstance(docs, list):
        result.add_issue("documents", "invalid_type", docs, corrected=True)

    return result


def _parse_date(value: Any, field_name: str, result: ValidationResult) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        result.add_issue(field_name, "invalid_date_format", value, corrected=True)
        return None
