from __future__ import annotations

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import AdjusterPlus, CurrentUser, DBSession, Pagination
from app.hitl import crud as hitl_crud
from app.hitl.schemas import (
    AssignRequest,
    InvestigationClose,
    InvestigationCreate,
    InvestigationOut,
    InvestigationUpdate,
    QueueItemOut,
)

router = APIRouter(prefix="/api/hitl", tags=["hitl"])


# ── Review Queue ──────────────────────────────────────────────────────────────

@router.get("/queue", response_model=List[QueueItemOut], summary="Priority-sorted HITL review queue")
async def get_queue(
    db: DBSession,
    current_user: CurrentUser,
    status: str = Query(default="pending", description="pending | in_review | completed | escalated"),
    limit: int = Query(default=50, le=200),
    mine: bool = Query(default=False, description="Only show items assigned to me"),
):
    assigned_to = current_user.id if mine else None
    items = await hitl_crud.get_queue(db, status=status, limit=limit, assigned_to=assigned_to)

    result = []
    for item in items:
        case = item.case
        row = QueueItemOut(
            id=item.id,
            case_id=item.case_id,
            priority_score=item.priority_score,
            reason=item.reason,
            assigned_to=item.assigned_to,
            assigned_username=item.assigned_user.username if item.assigned_user else None,
            status=item.status,
            created_at=item.created_at,
            updated_at=item.updated_at,
            claim_type=case.claim_type if case else None,
            amount_claimed=case.amount_claimed if case else None,
            fraud_score=case.fraud_score if case else None,
            fraud_band=case.fraud_band if case else None,
            complexity_score=case.complexity_score if case else None,
        )
        result.append(row)

    return result


@router.get("/queue/{item_id}", response_model=QueueItemOut)
async def get_queue_item(item_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    item = await hitl_crud.get_queue_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found")
    case = item.case
    return QueueItemOut(
        id=item.id, case_id=item.case_id, priority_score=item.priority_score,
        reason=item.reason, assigned_to=item.assigned_to, status=item.status,
        created_at=item.created_at, updated_at=item.updated_at,
        claim_type=case.claim_type if case else None,
        amount_claimed=case.amount_claimed if case else None,
        fraud_score=case.fraud_score if case else None,
        fraud_band=case.fraud_band if case else None,
        complexity_score=case.complexity_score if case else None,
    )


@router.patch("/queue/{item_id}/assign", response_model=QueueItemOut)
async def assign_queue_item(
    item_id: uuid.UUID,
    body: AssignRequest,
    db: DBSession,
    current_user: CurrentUser,
    _: Annotated[None, AdjusterPlus],
):
    """Assign queue item to a reviewer. Pass assigned_to=null to unassign."""
    item = await hitl_crud.get_queue_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found")

    assigned_id = body.assigned_to
    updated = await hitl_crud.assign_queue_item(db, item, assigned_id)
    case = updated.case
    return QueueItemOut(
        id=updated.id, case_id=updated.case_id, priority_score=updated.priority_score,
        reason=updated.reason, assigned_to=updated.assigned_to, status=updated.status,
        created_at=updated.created_at, updated_at=updated.updated_at,
        claim_type=case.claim_type if case else None,
        amount_claimed=case.amount_claimed if case else None,
        fraud_score=case.fraud_score if case else None,
        fraud_band=case.fraud_band if case else None,
        complexity_score=case.complexity_score if case else None,
    )


@router.post("/queue/{item_id}/assign-me", response_model=QueueItemOut)
async def assign_to_me(item_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    """Shortcut: assign this queue item to the currently logged-in user."""
    item = await hitl_crud.get_queue_item(db, item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue item not found")
    updated = await hitl_crud.assign_queue_item(db, item, current_user.id)
    case = updated.case
    return QueueItemOut(
        id=updated.id, case_id=updated.case_id, priority_score=updated.priority_score,
        reason=updated.reason, assigned_to=updated.assigned_to, status=updated.status,
        created_at=updated.created_at, updated_at=updated.updated_at,
        claim_type=case.claim_type if case else None,
        amount_claimed=case.amount_claimed if case else None,
        fraud_score=case.fraud_score if case else None,
        fraud_band=case.fraud_band if case else None,
        complexity_score=case.complexity_score if case else None,
    )


# ── Investigations ────────────────────────────────────────────────────────────

@router.post(
    "/investigations",
    response_model=InvestigationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Open a new investigation",
)
async def open_investigation(
    body: InvestigationCreate,
    db: DBSession,
    current_user: CurrentUser,
    _: Annotated[None, AdjusterPlus],
):
    inv = await hitl_crud.create_investigation(
        db, case_id=body.case_id, investigator_id=current_user.id, notes=body.notes
    )

    # Write audit event on the case
    from app.cases.models import CaseEvent
    from datetime import datetime, timezone
    event = CaseEvent(
        case_id=body.case_id,
        event_type="investigation_opened",
        actor=current_user.username,
        actor_id=current_user.id,
        payload={"investigation_id": str(inv.id), "investigator": current_user.username},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()

    return InvestigationOut(
        id=inv.id, case_id=inv.case_id, investigator_id=inv.investigator_id,
        investigator_name=current_user.full_name, status=inv.status,
        notes=inv.notes, findings=inv.findings, opened_at=inv.opened_at,
        closed_at=inv.closed_at, outcome=inv.outcome,
    )


@router.get("/investigations", response_model=List[InvestigationOut])
async def list_investigations(
    db: DBSession,
    current_user: CurrentUser,
    pagination: Pagination,
    status: Optional[str] = Query(None),
    mine: bool = Query(default=False),
):
    investigator_id = current_user.id if mine else None
    invs = await hitl_crud.list_investigations(
        db, investigator_id=investigator_id, status=status, limit=pagination["limit"]
    )
    return [
        InvestigationOut(
            id=i.id, case_id=i.case_id, investigator_id=i.investigator_id,
            investigator_name=i.investigator.full_name if i.investigator else None,
            status=i.status, notes=i.notes, findings=i.findings,
            opened_at=i.opened_at, closed_at=i.closed_at, outcome=i.outcome,
        )
        for i in invs
    ]


@router.get("/investigations/{investigation_id}", response_model=InvestigationOut)
async def get_investigation(
    investigation_id: uuid.UUID, db: DBSession, current_user: CurrentUser
):
    inv = await hitl_crud.get_investigation(db, investigation_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
    return InvestigationOut(
        id=inv.id, case_id=inv.case_id, investigator_id=inv.investigator_id,
        investigator_name=inv.investigator.full_name if inv.investigator else None,
        status=inv.status, notes=inv.notes, findings=inv.findings,
        opened_at=inv.opened_at, closed_at=inv.closed_at, outcome=inv.outcome,
    )


@router.patch("/investigations/{investigation_id}", response_model=InvestigationOut)
async def update_investigation(
    investigation_id: uuid.UUID,
    body: InvestigationUpdate,
    db: DBSession,
    current_user: CurrentUser,
    _: Annotated[None, AdjusterPlus],
):
    inv = await hitl_crud.get_investigation(db, investigation_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
    inv = await hitl_crud.update_investigation(
        db, inv, status=body.status, notes=body.notes, findings=body.findings
    )
    return InvestigationOut(
        id=inv.id, case_id=inv.case_id, investigator_id=inv.investigator_id,
        investigator_name=inv.investigator.full_name if inv.investigator else None,
        status=inv.status, notes=inv.notes, findings=inv.findings,
        opened_at=inv.opened_at, closed_at=inv.closed_at, outcome=inv.outcome,
    )


@router.post("/investigations/{investigation_id}/close", response_model=InvestigationOut)
async def close_investigation(
    investigation_id: uuid.UUID,
    body: InvestigationClose,
    db: DBSession,
    current_user: CurrentUser,
    _: Annotated[None, AdjusterPlus],
):
    valid_outcomes = {"fraud_confirmed", "legitimate", "inconclusive", "referred_to_ira"}
    if body.outcome not in valid_outcomes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Outcome must be one of {sorted(valid_outcomes)}")

    inv = await hitl_crud.get_investigation(db, investigation_id)
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")
    if inv.status == "closed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Investigation is already closed")

    inv = await hitl_crud.close_investigation(
        db, inv, outcome=body.outcome, notes=body.notes, findings=body.findings
    )

    # Audit event on the case
    from app.cases.models import CaseEvent
    from datetime import datetime, timezone
    event = CaseEvent(
        case_id=inv.case_id,
        event_type="investigation_closed",
        actor=current_user.username,
        actor_id=current_user.id,
        payload={"investigation_id": str(inv.id), "outcome": body.outcome},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()

    return InvestigationOut(
        id=inv.id, case_id=inv.case_id, investigator_id=inv.investigator_id,
        investigator_name=inv.investigator.full_name if inv.investigator else None,
        status=inv.status, notes=inv.notes, findings=inv.findings,
        opened_at=inv.opened_at, closed_at=inv.closed_at, outcome=inv.outcome,
    )
