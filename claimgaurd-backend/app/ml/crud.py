from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ml.models import FeatureSnapshot, MLPrediction, ModelFeedback, ModelRegistry, TrainingRun


# ── Model Registry ────────────────────────────────────────────────────────────

async def get_champion(db: AsyncSession, model_family: str = "claims_fraud") -> Optional[ModelRegistry]:
    result = await db.execute(
        select(ModelRegistry)
        .where(ModelRegistry.model_family == model_family)
        .where(ModelRegistry.status == "champion")
        .order_by(ModelRegistry.promoted_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_all_models(db: AsyncSession, model_family: Optional[str] = None) -> List[ModelRegistry]:
    q = select(ModelRegistry).order_by(ModelRegistry.created_at.desc())
    if model_family:
        q = q.where(ModelRegistry.model_family == model_family)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_model_by_id(db: AsyncSession, model_id: uuid.UUID) -> Optional[ModelRegistry]:
    result = await db.execute(select(ModelRegistry).where(ModelRegistry.id == model_id))
    return result.scalar_one_or_none()


async def promote_model(db: AsyncSession, model: ModelRegistry, promoted_by_id: uuid.UUID) -> ModelRegistry:
    """Promote challenger → champion. Archive existing champion."""
    from datetime import datetime, timezone
    # Archive existing champion
    existing = await get_champion(db, model.model_family)
    if existing:
        existing.status = "archived"
        db.add(existing)

    model.status = "champion"
    model.promoted_at = datetime.now(timezone.utc)
    model.promoted_by = promoted_by_id
    db.add(model)
    await db.flush()

    # Invalidate in-process model cache so scorer picks up the new champion
    from app.ml.scorer import invalidate_model_cache
    invalidate_model_cache()

    return model


async def reject_model(db: AsyncSession, model: ModelRegistry) -> ModelRegistry:
    model.status = "rejected"
    db.add(model)
    await db.flush()
    return model


# ── Training Runs ─────────────────────────────────────────────────────────────

async def get_training_runs(db: AsyncSession, limit: int = 20) -> List[TrainingRun]:
    result = await db.execute(
        select(TrainingRun)
        .options(selectinload(TrainingRun.model))
        .order_by(TrainingRun.started_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


# ── Predictions ───────────────────────────────────────────────────────────────

async def get_prediction_for_case(
    db: AsyncSession, case_id: uuid.UUID
) -> Optional[MLPrediction]:
    result = await db.execute(
        select(MLPrediction)
        .where(MLPrediction.case_id == case_id)
        .order_by(MLPrediction.predicted_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ── Feedback ──────────────────────────────────────────────────────────────────

async def get_feedback_queue(db: AsyncSession, limit: int = 50) -> List[ModelFeedback]:
    """Unrated predictions sorted by oldest first for review."""
    result = await db.execute(
        select(ModelFeedback)
        .where(ModelFeedback.rating.is_(None))
        .where(ModelFeedback.source == "human_review")
        .order_by(ModelFeedback.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_recent_feedback(db: AsyncSession, limit: int = 20) -> List[ModelFeedback]:
    result = await db.execute(
        select(ModelFeedback)
        .order_by(ModelFeedback.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_explicit_feedback(
    db: AsyncSession,
    case_id: uuid.UUID,
    prediction_id: Optional[uuid.UUID],
    rating: str,
    note: Optional[str],
    reviewer_id: uuid.UUID,
) -> ModelFeedback:
    fb = ModelFeedback(
        case_id=case_id,
        prediction_id=prediction_id,
        source="explicit_rating",
        rating=rating,
        note=note,
        reviewer_id=reviewer_id,
    )
    db.add(fb)
    await db.flush()
    return fb


# ── Override rate tracking ────────────────────────────────────────────────────

async def get_override_rate(db: AsyncSession, days: int = 30) -> float:
    """
    Calculate reviewer override rate over the last N days.
    Override = reviewer approved a high-fraud case OR declined a low-fraud case.
    """
    from datetime import timedelta, timezone, datetime
    from sqlalchemy import func
    from app.hitl.models import ReviewDecision

    since = datetime.now(timezone.utc) - timedelta(days=days)
    total_result = await db.execute(
        select(func.count(ReviewDecision.id))
        .where(ReviewDecision.decided_at >= since)
    )
    total = total_result.scalar_one() or 0

    override_result = await db.execute(
        select(func.count(ReviewDecision.id))
        .where(ReviewDecision.decided_at >= since)
        .where(ReviewDecision.is_override == True)  # noqa: E712
    )
    overrides = override_result.scalar_one() or 0

    return round(overrides / total, 4) if total > 0 else 0.0
