from __future__ import annotations

import io
import os
import pickle
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple

# ── NOTE: numpy, pandas, sklearn, xgboost are intentionally NOT imported at
# module level. They consume ~360 MB of RAM on import and are only needed when
# a training run is triggered. Lazy-importing them inside run_training_pipeline()
# and _build_dataset() keeps the idle worker and API process within Render's
# 512 MB free-tier limit.
# ─────────────────────────────────────────────────────────────────────────────

from app.core.db import SyncSessionLocal

# Minimum floor: must beat this AUC on test set to register as challenger
MIN_AUC_FLOOR = 0.60

FEATURE_NAMES = [
    "days_since_inception", "days_to_report", "policy_age_days", "vehicle_age_years",
    "weekend_incident", "hour_of_report",
    "amount_claimed", "claim_to_limit_ratio", "amount_over_limit",
    "is_round_number", "claim_amount_log",
    "provider_claim_count_30d", "provider_claim_count_90d", "provider_claim_amount_30d",
    "prior_claims_count", "prior_claims_total_amount", "prior_motor_claims_count",
    "document_completeness_score", "has_police_abstract", "has_valuers_report",
    "has_repair_quotation", "claim_type_encoded", "motor_class_encoded",
    "county_risk_tier", "ob_number_duplicate",
]


def run_training_pipeline(
    triggered_by_id: Optional[str] = None,
    model_family: str = "claims_fraud",
) -> dict:
    """
    Full training pipeline — synchronous, called from Celery task or API.

    Steps:
    1. Load labeled feature snapshots (via model_feedback + feature_snapshot JOIN)
    2. Fall back to segment_data.is_fraud labels if feedback is sparse
    3. Split 70/15/15 train/val/test (stratified)
    4. Train XGBoostClassifier with balanced class weights
    5. Evaluate on test set
    6. Assert minimum AUC floor
    7. Save model artifact (local in dev, MinIO in prod)
    8. Register as challenger in model_registry
    9. Return metrics dict
    """
    # Lazy-load heavy ML stack — only pays the RAM cost when training is called
    import numpy as np
    import pandas as pd
    from sklearn.metrics import (
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
    from sklearn.utils.class_weight import compute_sample_weight
    from xgboost import XGBClassifier

    import app.users.models  # noqa: F401
    import app.cases.models  # noqa: F401
    import app.ml.models  # noqa: F401
    import app.quality.models  # noqa: F401
    import app.hitl.models  # noqa: F401
    import app.rules.models  # noqa: F401
    import app.ingestion.models  # noqa: F401

    from app.ml.models import FeatureSnapshot, ModelFeedback, ModelRegistry, TrainingRun
    from sqlalchemy import select

    db = SyncSessionLocal()

    # ── Create training run record ─────────────────────────────────────────────
    run = TrainingRun(
        triggered_by=uuid.UUID(triggered_by_id) if triggered_by_id else None,
        started_at=datetime.now(timezone.utc),
        status="running",
    )
    db.add(run)
    db.commit()
    run_id = str(run.id)

    try:
        # ── 1. Build labeled dataset ──────────────────────────────────────────
        X, y = _build_dataset(db)

        if len(X) < 20:
            raise ValueError(
                f"Not enough training data: only {len(X)} labeled samples. "
                "Seed more data and process claims first."
            )

        fraud_count = int(y.sum())
        clean_count = int(len(y) - fraud_count)
        fraud_rate = round(fraud_count / len(y), 4)

        # ── 2. Train/val/test split ───────────────────────────────────────────
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.30, stratify=y, random_state=42
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_test, y_test, test_size=0.50, stratify=y_test, random_state=42
        )

        # ── 3. Train XGBoost ──────────────────────────────────────────────────
        sample_weights = compute_sample_weight("balanced", y_train)
        model = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
            verbosity=0,
        )
        model.fit(
            X_train, y_train,
            sample_weight=sample_weights,
            eval_set=[(X_val, y_val)],
            verbose=False,
        )

        # ── 4. Evaluate ───────────────────────────────────────────────────────
        y_prob = model.predict_proba(X_test)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)

        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec  = float(recall_score(y_test, y_pred, zero_division=0))
        f1   = float(f1_score(y_test, y_pred, zero_division=0))
        auc  = float(roc_auc_score(y_test, y_prob)) if len(set(y_test)) > 1 else 0.5

        # False positive rate on clean-claim subset
        clean_mask = (y_test == 0)
        fpr = float((y_pred[clean_mask] == 1).mean()) if clean_mask.sum() > 0 else 0.0

        if auc < MIN_AUC_FLOOR:
            raise ValueError(
                f"Model AUC {auc:.3f} is below minimum floor {MIN_AUC_FLOOR}. "
                "Need more labeled data or better features."
            )

        # ── 5. Save artifact ──────────────────────────────────────────────────
        artifact_path = _save_artifact(model, model_family)

        # ── 6. Determine next version ─────────────────────────────────────────
        existing = db.execute(
            select(ModelRegistry)
            .where(ModelRegistry.model_family == model_family)
            .order_by(ModelRegistry.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()

        if existing:
            try:
                last_num = int(existing.version.lstrip("v"))
                version = f"v{last_num + 1}"
            except ValueError:
                version = "v1"
        else:
            version = "v1"

        # ── 7. Register challenger ────────────────────────────────────────────
        registry = ModelRegistry(
            model_family=model_family,
            version=version,
            algorithm="XGBClassifier",
            status="challenger",
            artifact_path=artifact_path,
            feature_names=FEATURE_NAMES,
            precision=Decimal(str(round(prec, 4))),
            recall=Decimal(str(round(rec, 4))),
            f1_score=Decimal(str(round(f1, 4))),
            auc_roc=Decimal(str(round(auc, 4))),
            false_positive_rate=Decimal(str(round(fpr, 4))),
            trained_rows=len(X),
        )
        db.add(registry)

        # ── 8. Update training run ────────────────────────────────────────────
        run.status = "completed"
        run.completed_at = datetime.now(timezone.utc)
        run.rows_used = len(X)
        run.fraud_rate = Decimal(str(fraud_rate))
        db.flush()
        run.model_registry_id = registry.id
        db.commit()

        return {
            "run_id": run_id,
            "model_registry_id": str(registry.id),
            "version": version,
            "status": "challenger",
            "rows_used": len(X),
            "fraud_count": fraud_count,
            "clean_count": clean_count,
            "fraud_rate": fraud_rate,
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "auc_roc": round(auc, 4),
            "false_positive_rate": round(fpr, 4),
        }

    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)[:2000]
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.close()
        raise

    finally:
        db.close()


def _build_dataset(db) -> Tuple["pd.DataFrame", "np.ndarray"]:
    """
    Build the labeled training dataset from feature_snapshot + fraud labels.

    Label sources (in priority order):
    1. model_feedback rows with source='human_review' (most reliable)
    2. segment_data.is_fraud=True from the synthetic injector (training signal)
    """
    import numpy as np
    import pandas as pd
    from sqlalchemy import select, text
    from app.ml.models import FeatureSnapshot, ModelFeedback
    from app.cases.models import Case

    rows = []
    labels = []

    # Strategy: join feature_snapshot → case → segment_data.is_fraud
    # This gives us a label for every case that has been through ETL
    case_rows = db.execute(
        select(Case.id, Case.segment_data)
        .where(Case.segment_data.isnot(None))
    ).all()

    # Build case_id → is_fraud lookup from segment_data
    fraud_labels: dict[str, bool] = {}
    for case_id, seg in case_rows:
        seg_dict = dict(seg or {})
        if "is_fraud" in seg_dict:
            fraud_labels[str(case_id)] = bool(seg_dict["is_fraud"])

    # Overlay with human review feedback (authoritative)
    feedback_rows = db.execute(
        select(ModelFeedback.case_id, ModelFeedback.rating)
        .where(ModelFeedback.source == "human_review")
    ).all()
    for case_id, rating in feedback_rows:
        if rating == "inaccurate":
            # Reviewer overrode the model — flip the label
            fraud_labels[str(case_id)] = not fraud_labels.get(str(case_id), False)
        elif rating == "accurate":
            pass  # keep existing label

    # Load feature snapshots and match labels
    snaps = db.execute(
        select(FeatureSnapshot.case_id, FeatureSnapshot.features)
    ).all()

    for case_id, features in snaps:
        case_id_str = str(case_id)
        if case_id_str not in fraud_labels:
            continue  # skip unlabeled

        feat_dict = dict(features or {})
        row = [float(feat_dict.get(f, 0) or 0) for f in FEATURE_NAMES]
        rows.append(row)
        labels.append(1 if fraud_labels[case_id_str] else 0)

    if not rows:
        raise ValueError("No labeled feature snapshots found. Run ETL pipeline first.")

    X = pd.DataFrame(rows, columns=FEATURE_NAMES)
    y = np.array(labels)
    return X, y


def _save_artifact(model, model_family: str) -> str:
    """
    Save pickled model. Returns the artifact path string.
    - Uses local /tmp filesystem when OBJECT_STORAGE_ENDPOINT is blank (Render free tier)
    - Uses MinIO/S3 when OBJECT_STORAGE_ENDPOINT is configured (production with storage)
    """
    from app.core.config import settings

    artifact_bytes = pickle.dumps(model)

    # Fall back to local filesystem if object storage is not configured
    use_local = settings.is_development or not settings.OBJECT_STORAGE_ENDPOINT.strip()

    if use_local:
        os.makedirs("/tmp/claimguard_models", exist_ok=True)
        fname = f"{model_family}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pkl"
        local_path = f"/tmp/claimguard_models/{fname}"
        with open(local_path, "wb") as f:
            f.write(artifact_bytes)
        return f"local://{local_path}"
    else:
        import boto3
        s3 = boto3.client(
            "s3",
            endpoint_url=settings.OBJECT_STORAGE_ENDPOINT,
            aws_access_key_id=settings.OBJECT_STORAGE_ACCESS_KEY,
            aws_secret_access_key=settings.OBJECT_STORAGE_SECRET_KEY,
        )
        fname = f"models/{model_family}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.pkl"
        s3.upload_fileobj(io.BytesIO(artifact_bytes), settings.OBJECT_STORAGE_BUCKET, fname)
        return fname
