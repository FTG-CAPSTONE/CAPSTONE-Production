from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cases.models import Case, CaseEvent, Document, Party, Policy
from app.hitl.models import ReviewDecision, ReviewQueueItem
from app.ml.models import ModelFeedback
from app.rules.models import RuleEvaluation


async def get_case_by_id(db: AsyncSession, case_id: uuid.UUID) -> Optional[Case]:
    result = await db.execute(
        select(Case)
        .options(
            selectinload(Case.policy),
            selectinload(Case.claimant),
            selectinload(Case.provider),
            selectinload(Case.documents),
            selectinload(Case.events),
        )
        .where(Case.id == case_id)
    )
    return result.scalar_one_or_none()


async def get_rule_evaluations(db: AsyncSession, case_id: uuid.UUID) -> list:
    result = await db.execute(
        select(RuleEvaluation).where(RuleEvaluation.case_id == case_id).order_by(RuleEvaluation.evaluated_at)
    )
    return list(result.scalars().all())


async def list_cases(
    db: AsyncSession, skip: int = 0, limit: int = 20,
    status: Optional[str] = None, line_of_business: Optional[str] = None, claim_type: Optional[str] = None,
) -> List[Case]:
    q = select(Case).order_by(Case.submitted_at.desc())
    if status:
        q = q.where(Case.status == status)
    if line_of_business:
        q = q.where(Case.line_of_business == line_of_business)
    if claim_type:
        q = q.where(Case.claim_type == claim_type)
    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return list(result.scalars().all())


async def record_decision(
    db: AsyncSession, case: Case, decision: str, rationale: str, reviewer
) -> ReviewDecision:
    status_map = {"approved": "approved", "declined": "declined",
                  "escalated": "in_review", "request_docs": "in_review"}
    new_status = status_map.get(decision, "in_review")

    is_override = (
        (case.fraud_band in ("high", "critical") and decision == "approved") or
        (case.fraud_band == "low" and decision == "declined")
    )

    case.status = new_status
    if new_status in ("approved", "declined"):
        case.closed_at = datetime.now(timezone.utc)
    db.add(case)

    review = ReviewDecision(
        case_id=case.id, reviewer_id=reviewer.id, decision=decision,
        rationale=rationale, overridden_score=case.fraud_score, is_override=is_override,
    )
    db.add(review)

    event = CaseEvent(
        case_id=case.id, event_type="reviewed", actor=reviewer.username, actor_id=reviewer.id,
        payload={"decision": decision, "rationale": rationale, "is_override": is_override, "case_status": new_status},
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)

    feedback = ModelFeedback(
        case_id=case.id, source="human_review",
        rating="accurate" if not is_override else "inaccurate",
        note=f"Decision: {decision}", reviewer_id=reviewer.id,
    )
    db.add(feedback)

    queue_result = await db.execute(select(ReviewQueueItem).where(ReviewQueueItem.case_id == case.id))
    queue_item = queue_result.scalar_one_or_none()
    if queue_item:
        queue_item.status = "completed"
        queue_item.updated_at = datetime.now(timezone.utc)
        db.add(queue_item)

    await db.flush()
    return review


async def get_similar_cases(db: AsyncSession, case: Case, limit: int = 5) -> List[Tuple]:
    similar = []
    if case.provider_id and case.amount_claimed:
        lo = float(case.amount_claimed) * 0.80
        hi = float(case.amount_claimed) * 1.20
        result = await db.execute(
            select(Case)
            .where(Case.provider_id == case.provider_id)
            .where(Case.claim_type == case.claim_type)
            .where(Case.amount_claimed.between(lo, hi))
            .where(Case.id != case.id)
            .limit(limit)
        )
        for c in result.scalars().all():
            similar.append((c, "same_provider_similar_amount"))
    return similar[:limit]
