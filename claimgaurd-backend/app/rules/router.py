from __future__ import annotations

import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.deps import CurrentUser, DBSession
from app.rules.engine import get_rule_catalogue

router = APIRouter(prefix="/api/rules", tags=["rules"])


class RuleEvaluationOut(BaseModel):
    id: uuid.UUID
    rule_code: str
    rule_version: str
    result: str
    severity: str | None
    description: str | None
    triggered_value: Dict[str, Any] | None
    evaluated_at: str
    model_config = {"from_attributes": True}


@router.get("/{case_id}/evaluations", response_model=List[RuleEvaluationOut])
async def get_rule_evaluations(case_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    from sqlalchemy import select
    from app.rules.models import RuleEvaluation
    rows = await db.execute(
        select(RuleEvaluation).where(RuleEvaluation.case_id == case_id).order_by(RuleEvaluation.evaluated_at)
    )
    return [
        RuleEvaluationOut(
            id=e.id, rule_code=e.rule_code, rule_version=e.rule_version, result=e.result,
            severity=e.severity, description=e.description, triggered_value=e.triggered_value,
            evaluated_at=e.evaluated_at.isoformat(),
        )
        for e in rows.scalars().all()
    ]


@router.get("/catalogue", response_model=List[Dict[str, Any]])
async def list_rule_catalogue(current_user: CurrentUser):
    return get_rule_catalogue()
