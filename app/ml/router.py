from __future__ import annotations

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DBSession, MLAdminOnly, Pagination
from app.ml import crud as ml_crud
from app.ml.schemas import (
    FeedbackRatingRequest,
    ModelFeedbackOut,
    MLOverview,
    MLPredictionOut,
    ModelFeedbackOut,
    ModelRegistryOut,
    RetrainResponse,
    TrainingRunOut,
)

router = APIRouter(prefix="/api/ml", tags=["ml-admin"])


# ── Overview ──────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=MLOverview)
async def ml_overview(db: DBSession, current_user: CurrentUser):
    champion = await ml_crud.get_champion(db, "claims_fraud")

    # Pending challenger
    from app.ml.models import ModelRegistry
    challenger_result = await db.execute(
        select(ModelRegistry)
        .where(ModelRegistry.model_family == "claims_fraud")
        .where(ModelRegistry.status == "challenger")
        .order_by(ModelRegistry.created_at.desc())
        .limit(1)
    )
    challenger = challenger_result.scalar_one_or_none()

    # Override rate
    override_rate = await ml_crud.get_override_rate(db, days=30)

    # Average confidence on recent predictions
    from app.ml.models import MLPrediction
    avg_conf_result = await db.execute(
        select(func.avg(MLPrediction.confidence))
        .where(MLPrediction.confidence.isnot(None))
    )
    avg_conf = avg_conf_result.scalar_one_or_none()

    total_pred_result = await db.execute(select(func.count(MLPrediction.id)))
    total_preds = total_pred_result.scalar_one() or 0

    note = None
    if champion is None:
        note = "No champion model yet. Run retrain to create one, then promote it."

    return MLOverview(
        champion=ModelRegistryOut.model_validate(champion) if champion else None,
        challenger_pending=ModelRegistryOut.model_validate(challenger) if challenger else None,
        override_rate_30d=override_rate,
        avg_confidence=round(float(avg_conf), 4) if avg_conf else None,
        total_predictions=total_preds,
        note=note,
    )


# ── Model Registry ────────────────────────────────────────────────────────────

@router.get("/model-registry", response_model=List[ModelRegistryOut])
async def list_model_registry(
    db: DBSession, current_user: CurrentUser,
    model_family: Optional[str] = None,
):
    return await ml_crud.get_all_models(db, model_family=model_family)


@router.get("/model-registry/{model_id}", response_model=ModelRegistryOut)
async def get_model(model_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    model = await ml_crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    return model


@router.patch("/model-registry/{model_id}/promote", response_model=ModelRegistryOut)
async def promote_model(
    model_id: uuid.UUID, db: DBSession, current_user: CurrentUser,
    _: Annotated[None, MLAdminOnly],
):
    model = await ml_crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if model.status != "challenger":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Only challenger models can be promoted. Status is '{model.status}'")
    return await ml_crud.promote_model(db, model, current_user.id)


@router.patch("/model-registry/{model_id}/reject", response_model=ModelRegistryOut)
async def reject_model(
    model_id: uuid.UUID, db: DBSession, current_user: CurrentUser,
    _: Annotated[None, MLAdminOnly],
):
    model = await ml_crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
    if model.status not in ("challenger",):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only challenger models can be rejected")
    return await ml_crud.reject_model(db, model)


# ── Training ──────────────────────────────────────────────────────────────────

@router.post("/retrain", response_model=RetrainResponse)
async def trigger_retrain(
    db: DBSession, current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    _: Annotated[None, MLAdminOnly],
):
    """
    Trigger a full retraining pipeline.
    Runs synchronously in a thread pool (CPU-bound work).
    Returns immediately with the training result (dev mode).
    """
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            None,
            _run_training_sync,
            str(current_user.id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Training failed: {str(exc)}")

    return RetrainResponse(**result)


def _run_training_sync(triggered_by_id: str) -> dict:
    from app.ml.trainer import run_training_pipeline
    return run_training_pipeline(triggered_by_id=triggered_by_id)


@router.get("/training-runs", response_model=List[TrainingRunOut])
async def list_training_runs(db: DBSession, current_user: CurrentUser, pagination: Pagination):
    return await ml_crud.get_training_runs(db, limit=pagination["limit"])


# ── Predictions ───────────────────────────────────────────────────────────────

@router.get("/predictions/{case_id}", response_model=MLPredictionOut)
async def get_prediction(case_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    prediction = await ml_crud.get_prediction_for_case(db, case_id)
    if not prediction:
        # No prediction yet — return a note
        return MLPredictionOut(
            id=uuid.uuid4(),
            case_id=case_id,
            predicted_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            note="No prediction available. Train and promote a model first.",
        )
    out = MLPredictionOut.model_validate(prediction)
    # Attach model version
    if prediction.model:
        out.model_version = prediction.model.version
    return out


# ── Feedback ──────────────────────────────────────────────────────────────────

@router.get("/feedback", response_model=List[ModelFeedbackOut])
async def get_feedback_queue(db: DBSession, current_user: CurrentUser, pagination: Pagination):
    return await ml_crud.get_recent_feedback(db, limit=pagination["limit"])


@router.post("/feedback", response_model=ModelFeedbackOut)
async def submit_feedback(body: FeedbackRatingRequest, db: DBSession, current_user: CurrentUser):
    if body.rating not in ("accurate", "inaccurate", "uncertain"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Rating must be: accurate | inaccurate | uncertain")
    return await ml_crud.create_explicit_feedback(
        db,
        case_id=body.case_id,
        prediction_id=body.prediction_id,
        rating=body.rating,
        note=body.note,
        reviewer_id=current_user.id,
    )
