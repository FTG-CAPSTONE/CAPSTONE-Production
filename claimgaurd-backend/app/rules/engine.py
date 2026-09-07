from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.rules.models import RuleEvaluation
from app.rules.motor_rules import MOTOR_RULE_FUNCTIONS


def evaluate_rules_sync(
    case_id: uuid.UUID, features: Dict[str, Any], db: Session, line_of_business: str = "motor"
) -> List[Dict[str, Any]]:
    results = []
    for rule_fn in _get_rules(line_of_business):
        result = rule_fn(features)
        row = RuleEvaluation(
            case_id=case_id,
            rule_code=result["rule_code"],
            rule_version="v1",
            result=result["result"],
            severity=result["severity"],
            triggered_value=result.get("triggered_value"),
            description=result["description"],
            evaluated_at=datetime.now(timezone.utc),
        )
        db.add(row)
        results.append(result)
    db.flush()
    return results


def _get_rules(line_of_business: str):
    return MOTOR_RULE_FUNCTIONS


def get_rule_catalogue() -> List[Dict[str, Any]]:
    catalogue = []
    for fn in MOTOR_RULE_FUNCTIONS:
        try:
            meta = fn({})
            catalogue.append({
                "rule_code": meta["rule_code"],
                "severity": meta["severity"],
                "description": meta["description"],
                "line_of_business": "motor",
            })
        except Exception:
            pass
    return catalogue
