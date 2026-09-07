from __future__ import annotations

import io
import pickle
import uuid
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session


# ── Band thresholds ───────────────────────────────────────────────────────────
BAND_THRESHOLDS = {"low": 40, "medium": 60, "high": 80}


def _score_to_band(score: float) -> str:
    if score >= BAND_THRESHOLDS["high"]:
        return "critical"
    elif score >= BAND_THRESHOLDS["medium"]:
        return "high"
    elif score >= BAND_THRESHOLDS["low"]:
        return "medium"
    return "low"


# ── In-process model cache ────────────────────────────────────────────────────
_model_cache: Dict[str, Any] = {}


def _load_model_artifact(artifact_path: str) -> Any:
    """Load pickled model from MinIO / local fallback."""
    if artifact_path in _model_cache:
        return _model_cache[artifact_path]

    if artifact_path.startswith("local://"):
        local_path = artifact_path[len("local://"):]
        with open(local_path, "rb") as f:
            model = pickle.load(f)
    else:
        # S3/MinIO path
        import boto3
        from app.core.config import settings
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.OBJECT_STORAGE_ENDPOINT,
            aws_access_key_id=settings.OBJECT_STORAGE_ACCESS_KEY,
            aws_secret_access_key=settings.OBJECT_STORAGE_SECRET_KEY,
        )
        buf = io.BytesIO()
        s3.download_fileobj(settings.OBJECT_STORAGE_BUCKET, artifact_path, buf)
        buf.seek(0)
        model = pickle.load(buf)

    _model_cache[artifact_path] = model
    return model


def invalidate_model_cache() -> None:
    """Call after a model is promoted so the scorer picks up the new champion."""
    _model_cache.clear()


def score_case(
    case_id: uuid.UUID,
    features: Dict[str, Any],
    db: Session,
) -> Optional[Dict[str, Any]]:
    """
    Score a case using the current champion fraud model.

    Returns a dict with score, band, confidence, shap_values, and prediction_id.
    Returns None if no champion model exists (case routes to HITL without score).
    """
    from sqlalchemy import select
    from app.ml.models import FeatureSnapshot, MLPrediction, ModelRegistry
    from app.ml.explainer import explain_prediction

    # ── 1. Get champion model ─────────────────────────────────────────────────
    champion = db.execute(
        select(ModelRegistry)
        .where(ModelRegistry.model_family == "claims_fraud")
        .where(ModelRegistry.status == "champion")
        .order_by(ModelRegistry.promoted_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if champion is None:
        return None

    # ── 2. Load model artifact ────────────────────────────────────────────────
    try:
        model = _load_model_artifact(champion.artifact_path)
    except Exception as exc:
        # Log but don't crash ETL
        return {"error": str(exc), "note": "model_load_failed"}

    # ── 3. Build feature vector ───────────────────────────────────────────────
    feature_names: List[str] = champion.feature_names or []
    import pandas as pd
    row = pd.DataFrame([{k: features.get(k, 0) for k in feature_names}])

    # ── 4. Predict ────────────────────────────────────────────────────────────
    try:
        prob = float(model.predict_proba(row)[0][1])   # P(fraud)
        confidence = float(model.predict_proba(row).max(axis=1)[0])
    except Exception:
        prob = 0.5
        confidence = 0.5

    score = round(prob * 100, 2)
    band = _score_to_band(score)

    # ── 5. SHAP explanation ───────────────────────────────────────────────────
    shap_values = explain_prediction(model, features, feature_names, top_n=5)

    # ── 6. Get linked feature snapshot ───────────────────────────────────────
    snap = db.execute(
        select(FeatureSnapshot)
        .where(FeatureSnapshot.case_id == case_id)
        .order_by(FeatureSnapshot.computed_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    # ── 7. Persist prediction ─────────────────────────────────────────────────
    prediction = MLPrediction(
        case_id=case_id,
        model_registry_id=champion.id,
        feature_snapshot_id=snap.id if snap else None,
        model_family="claims_fraud",
        score=Decimal(str(score)),
        band=band,
        confidence=Decimal(str(round(confidence, 4))),
        shap_values=shap_values,
    )
    db.add(prediction)
    db.flush()

    return {
        "prediction_id": str(prediction.id),
        "score": score,
        "band": band,
        "confidence": round(confidence, 4),
        "shap_values": shap_values,
        "model_version": champion.version,
    }
