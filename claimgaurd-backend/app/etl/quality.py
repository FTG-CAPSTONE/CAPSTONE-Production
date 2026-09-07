from __future__ import annotations

import uuid
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.etl.validate import ValidationResult
from app.quality.models import DataQualityEvent


def log_quality_events(
    db: Session,
    case_id: uuid.UUID | None,
    ingest_log_id: uuid.UUID | None,
    validation_result: ValidationResult,
) -> None:
    for issue in validation_result.issues:
        event = DataQualityEvent(
            case_id=case_id,
            ingest_log_id=ingest_log_id,
            field_name=issue.get("field"),
            issue_type=issue.get("issue_type"),
            raw_value=str(issue.get("raw_value", ""))[:500],
            decision=validation_result.decision,
        )
        db.add(event)
    db.flush()


def compute_quality_gate_decision(validation_result: ValidationResult) -> str:
    return validation_result.decision
