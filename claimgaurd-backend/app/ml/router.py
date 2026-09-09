from __future__ import annotations

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel
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


# ── ML Performance dashboard schemas ─────────────────────────────────────────

class ROCPoint(BaseModel):
    fpr: float
    tpr: float
    threshold: float


class ConfusionMatrix(BaseModel):
    tp: int
    fp: int
    tn: int
    fn: int
    precision: float
    recall: float
    f1: float


class MetricHistoryPoint(BaseModel):
    version: str
    trained_at: str
    status: str
    auc_roc: Optional[float]
    f1_score: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    false_positive_rate: Optional[float]
    trained_rows: Optional[int]


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class MLPerformanceResponse(BaseModel):
    model_version: str
    model_id: str
    trained_rows: Optional[int]
    auc_roc: Optional[float]
    f1_score: Optional[float]
    precision: Optional[float]
    recall: Optional[float]
    false_positive_rate: Optional[float]
    roc_curve: List[ROCPoint]
    confusion_matrix: Optional[ConfusionMatrix]
    metric_history: List[MetricHistoryPoint]
    feature_importances: List[FeatureImportanceItem]


# ── ML Performance endpoint ───────────────────────────────────────────────────

@router.get("/performance", response_model=MLPerformanceResponse)
async def ml_performance(
    db: DBSession,
    current_user: CurrentUser,
    model_id: Optional[uuid.UUID] = None,
):
    """
    Returns chart-ready performance data for the ML Admin dashboard:
    - ROC curve approximated from stored AUC/FPR/recall metrics
    - Confusion matrix reconstructed from precision/recall + prediction counts
    - Metric history across all registered model versions
    - Feature importances from model artifact or SHAP aggregation fallback
    """
    from app.ml.models import ModelRegistry, MLPrediction
    import numpy as np

    if model_id:
        model_res = await db.execute(select(ModelRegistry).where(ModelRegistry.id == model_id))
        model = model_res.scalar_one_or_none()
        if not model:
            raise HTTPException(status_code=404, detail="Model not found")
    else:
        model = await ml_crud.get_champion(db, "claims_fraud")
        if not model:
            res = await db.execute(
                select(ModelRegistry)
                .where(ModelRegistry.model_family == "claims_fraud")
                .order_by(ModelRegistry.created_at.desc())
                .limit(1)
            )
            model = res.scalar_one_or_none()

    if not model:
        raise HTTPException(
            status_code=404,
            detail="No trained model found. Run /api/ml/retrain first.",
        )

    # Metric history
    all_models_res = await db.execute(
        select(ModelRegistry)
        .where(ModelRegistry.model_family == "claims_fraud")
        .order_by(ModelRegistry.created_at.asc())
    )
    all_models = all_models_res.scalars().all()
    metric_history = [
        MetricHistoryPoint(
            version=m.version,
            trained_at=m.created_at.strftime("%Y-%m-%d %H:%M"),
            status=m.status,
            auc_roc=float(m.auc_roc) if m.auc_roc is not None else None,
            f1_score=float(m.f1_score) if m.f1_score is not None else None,
            precision=float(m.precision) if m.precision is not None else None,
            recall=float(m.recall) if m.recall is not None else None,
            false_positive_rate=float(m.false_positive_rate) if m.false_positive_rate is not None else None,
            trained_rows=m.trained_rows,
        )
        for m in all_models
    ]

    # Approximate ROC curve
    auc = float(model.auc_roc) if model.auc_roc else 0.5
    tpr_op = float(model.recall) if model.recall else 0.5
    fpr_op = float(model.false_positive_rate) if model.false_positive_rate else 0.2
    roc_curve: List[ROCPoint] = [ROCPoint(fpr=0.0, tpr=0.0, threshold=1.0)]
    thresholds = np.linspace(0.95, 0.05, 19)
    for i, t in enumerate(thresholds):
        progress = (i + 1) / 20.0
        fpr_val = float(progress ** (1.0 / max(auc, 0.51)))
        tpr_val = float(progress ** max(0.1, 1.0 - auc + 0.05))
        if 0.4 <= progress <= 0.6:
            fpr_val = fpr_op + (fpr_val - fpr_op) * 0.3
            tpr_val = tpr_op + (tpr_val - tpr_op) * 0.3
        roc_curve.append(ROCPoint(fpr=round(fpr_val, 3), tpr=round(tpr_val, 3), threshold=round(float(t), 2)))
    roc_curve.append(ROCPoint(fpr=1.0, tpr=1.0, threshold=0.0))

    # Confusion matrix
    pred_count_res = await db.execute(
        select(func.count(MLPrediction.id)).where(MLPrediction.model_registry_id == model.id)
    )
    pred_count = pred_count_res.scalar_one() or 0
    conf_matrix = None
    if pred_count > 0 and model.precision and model.recall and model.f1_score:
        prec = float(model.precision)
        rec = float(model.recall)
        fpr = float(model.false_positive_rate) if model.false_positive_rate else 0.15
        estimated_fraud = max(1, int(pred_count * 0.20))
        estimated_clean = pred_count - estimated_fraud
        tp = max(1, int(estimated_fraud * rec))
        fn = max(0, estimated_fraud - tp)
        fp = max(1, int(estimated_clean * fpr))
        tn = max(0, estimated_clean - fp)
        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
        conf_matrix = ConfusionMatrix(tp=tp, fp=fp, tn=tn, fn=fn,
                                      precision=round(p, 3), recall=round(r, 3), f1=round(f, 3))

    # Feature importances
    feature_importances: List[FeatureImportanceItem] = []
    if hasattr(model, "artifact_path") and model.artifact_path and hasattr(model, "feature_names") and model.feature_names:
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            importances = await loop.run_in_executor(None, _load_feature_importances, model.artifact_path)
            if importances:
                feature_importances = sorted(
                    [FeatureImportanceItem(feature=name, importance=round(float(imp), 4))
                     for name, imp in zip(model.feature_names, importances) if imp > 0.001],
                    key=lambda x: x.importance, reverse=True,
                )[:15]
        except Exception:
            pass

    if not feature_importances:
        shap_res = await db.execute(
            select(MLPrediction.shap_values)
            .where(MLPrediction.model_registry_id == model.id)
            .where(MLPrediction.shap_values.isnot(None))
            .limit(100)
        )
        all_shap = shap_res.scalars().all()
        if all_shap:
            impact_totals: dict[str, float] = {}
            for shap_list in all_shap:
                for item in (shap_list or []):
                    feat = item.get("feature", "")
                    impact = abs(float(item.get("impact", 0)))
                    impact_totals[feat] = impact_totals.get(feat, 0.0) + impact
            total_impact = sum(impact_totals.values()) or 1.0
            feature_importances = sorted(
                [FeatureImportanceItem(feature=f, importance=round(v / total_impact, 4))
                 for f, v in impact_totals.items()],
                key=lambda x: x.importance, reverse=True,
            )[:15]

    return MLPerformanceResponse(
        model_version=model.version,
        model_id=str(model.id),
        trained_rows=model.trained_rows,
        auc_roc=float(model.auc_roc) if model.auc_roc else None,
        f1_score=float(model.f1_score) if model.f1_score else None,
        precision=float(model.precision) if model.precision else None,
        recall=float(model.recall) if model.recall else None,
        false_positive_rate=float(model.false_positive_rate) if model.false_positive_rate else None,
        roc_curve=roc_curve,
        confusion_matrix=conf_matrix,
        metric_history=metric_history,
        feature_importances=feature_importances,
    )


def _load_feature_importances(artifact_path: str) -> list:
    """Load feature importances from pickled model artifact (runs in thread pool)."""
    import pickle
    path = artifact_path.replace("local://", "")
    with open(path, "rb") as f:
        model_obj = pickle.load(f)
    return list(model_obj.feature_importances_)
