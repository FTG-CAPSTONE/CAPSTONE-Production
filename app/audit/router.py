from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.cases.models import CaseEvent
from app.core.deps import CurrentUser, DBSession, Pagination

router = APIRouter(prefix="/api/audit", tags=["audit"])


class AuditEventOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    event_type: str
    actor: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    occurred_at: datetime
    model_config = {"from_attributes": True}


@router.get("", response_model=List[AuditEventOut])
async def get_audit_trail(
    db: DBSession, current_user: CurrentUser, pagination: Pagination,
    case_id: Optional[uuid.UUID] = Query(None),
    actor: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
):
    q = select(CaseEvent).order_by(CaseEvent.occurred_at.desc())
    if case_id:
        q = q.where(CaseEvent.case_id == case_id)
    if actor:
        q = q.where(CaseEvent.actor == actor)
    if event_type:
        q = q.where(CaseEvent.event_type == event_type)
    q = q.offset(pagination["skip"]).limit(pagination["limit"])
    result = await db.execute(q)
    return [AuditEventOut.model_validate(e) for e in result.scalars().all()]


@router.get("/{case_id}", response_model=List[AuditEventOut])
async def get_case_audit(case_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    result = await db.execute(
        select(CaseEvent).where(CaseEvent.case_id == case_id).order_by(CaseEvent.occurred_at)
    )
    return [AuditEventOut.model_validate(e) for e in result.scalars().all()]
