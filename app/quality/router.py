from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession, Pagination
from app.quality.models import DataQualityEvent

router = APIRouter(prefix="/api/quality", tags=["quality"])


class DataQualityEventOut(BaseModel):
    id: uuid.UUID
    case_id: Optional[uuid.UUID] = None
    field_name: Optional[str] = None
    issue_type: Optional[str] = None
    raw_value: Optional[str] = None
    decision: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class QualitySummaryOut(BaseModel):
    trusted: int
    corrected: int
    rejected: int
    total: int
    trusted_pct: float
    recent_events: List[DataQualityEventOut]


@router.get("/summary", response_model=QualitySummaryOut)
async def quality_summary(db: DBSession, current_user: CurrentUser):
    counts_result = await db.execute(
        select(DataQualityEvent.decision, func.count(DataQualityEvent.id)).group_by(DataQualityEvent.decision)
    )
    counts: Dict[str, int] = {row[0]: row[1] for row in counts_result.all() if row[0]}
    trusted = counts.get("trusted", 0)
    corrected = counts.get("corrected", 0)
    rejected = counts.get("rejected", 0)
    total = trusted + corrected + rejected
    recent_result = await db.execute(
        select(DataQualityEvent).order_by(DataQualityEvent.created_at.desc()).limit(10)
    )
    recent = list(recent_result.scalars().all())
    return QualitySummaryOut(
        trusted=trusted, corrected=corrected, rejected=rejected, total=total,
        trusted_pct=round((trusted / total * 100) if total > 0 else 100.0, 1),
        recent_events=[DataQualityEventOut.model_validate(e) for e in recent],
    )


@router.get("/events", response_model=List[DataQualityEventOut])
async def list_quality_events(
    db: DBSession, current_user: CurrentUser, pagination: Pagination,
    decision: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
):
    q = select(DataQualityEvent).order_by(DataQualityEvent.created_at.desc())
    if decision:
        q = q.where(DataQualityEvent.decision == decision)
    if issue_type:
        q = q.where(DataQualityEvent.issue_type == issue_type)
    q = q.offset(pagination["skip"]).limit(pagination["limit"])
    result = await db.execute(q)
    return [DataQualityEventOut.model_validate(e) for e in result.scalars().all()]
