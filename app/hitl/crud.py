from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.hitl.models import Investigation, ReviewDecision, ReviewQueueItem


# ── Queue ─────────────────────────────────────────────────────────────────────

def _queue_options():
    """Standard eager-load options for ReviewQueueItem queries."""
    from app.cases.models import Case
    from app.users.models import AppUser
    return [
        selectinload(ReviewQueueItem.case),
        selectinload(ReviewQueueItem.assigned_user),
    ]


async def get_queue(
    db: AsyncSession,
    status: str = "pending",
    limit: int = 50,
    assigned_to: Optional[uuid.UUID] = None,
) -> List[ReviewQueueItem]:
    q = (
        select(ReviewQueueItem)
        .options(*_queue_options())
        .where(ReviewQueueItem.status == status)
        .order_by(ReviewQueueItem.priority_score.desc().nullslast())
    )
    if assigned_to:
        q = q.where(ReviewQueueItem.assigned_to == assigned_to)
    q = q.limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_queue_item(db: AsyncSession, item_id: uuid.UUID) -> Optional[ReviewQueueItem]:
    result = await db.execute(
        select(ReviewQueueItem)
        .options(*_queue_options())
        .where(ReviewQueueItem.id == item_id)
    )
    return result.scalar_one_or_none()


async def get_queue_item_by_case(db: AsyncSession, case_id: uuid.UUID) -> Optional[ReviewQueueItem]:
    result = await db.execute(
        select(ReviewQueueItem)
        .options(*_queue_options())
        .where(ReviewQueueItem.case_id == case_id)
    )
    return result.scalar_one_or_none()


async def assign_queue_item(
    db: AsyncSession,
    item: ReviewQueueItem,
    assigned_to: Optional[uuid.UUID],
) -> ReviewQueueItem:
    item.assigned_to = assigned_to
    item.status = "in_review" if assigned_to else "pending"
    item.updated_at = datetime.now(timezone.utc)
    db.add(item)
    await db.flush()
    return item


# ── Investigations ────────────────────────────────────────────────────────────

async def create_investigation(
    db: AsyncSession,
    case_id: uuid.UUID,
    investigator_id: uuid.UUID,
    notes: Optional[str] = None,
) -> Investigation:
    inv = Investigation(
        case_id=case_id,
        investigator_id=investigator_id,
        status="open",
        notes=notes,
    )
    db.add(inv)
    await db.flush()
    return inv


async def get_investigation(
    db: AsyncSession, investigation_id: uuid.UUID
) -> Optional[Investigation]:
    result = await db.execute(
        select(Investigation).where(Investigation.id == investigation_id)
    )
    return result.scalar_one_or_none()


async def list_investigations(
    db: AsyncSession,
    investigator_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    limit: int = 50,
) -> List[Investigation]:
    q = select(Investigation).order_by(Investigation.opened_at.desc())
    if investigator_id:
        q = q.where(Investigation.investigator_id == investigator_id)
    if status:
        q = q.where(Investigation.status == status)
    q = q.limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def update_investigation(
    db: AsyncSession,
    inv: Investigation,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    findings: Optional[dict] = None,
) -> Investigation:
    if status:
        inv.status = status
    if notes is not None:
        # Append to existing notes
        existing = inv.notes or ""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        inv.notes = f"{existing}\n\n[{timestamp}] {notes}".strip()
    if findings is not None:
        inv.findings = findings
    db.add(inv)
    await db.flush()
    return inv


async def close_investigation(
    db: AsyncSession,
    inv: Investigation,
    outcome: str,
    notes: Optional[str] = None,
    findings: Optional[dict] = None,
) -> Investigation:
    inv.status = "closed"
    inv.outcome = outcome
    inv.closed_at = datetime.now(timezone.utc)
    if notes:
        existing = inv.notes or ""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        inv.notes = f"{existing}\n\n[{timestamp}] CLOSED: {notes}".strip()
    if findings is not None:
        inv.findings = findings
    db.add(inv)
    await db.flush()
    return inv
