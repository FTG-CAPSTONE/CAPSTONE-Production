from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ModelRegistryOut(BaseModel):
    id: uuid.UUID
    model_family: str
    version: str
    algorithm: Optional[str] = None
    status: str
    precision: Optional[Decimal] = None
    recall: Optional[Decimal] = None
    f1_score: Optional[Decimal] = None
    auc_roc: Optional[Decimal] = None
    false_positive_rate: Optional[Decimal] = None
    trained_rows: Optional[int] = None
    feature_names: Optional[List[str]] = None
    promoted_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True, "protected_namespaces": ()}


class TrainingRunOut(BaseModel):
    id: uuid.UUID
    model_registry_id: Optional[uuid.UUID] = None
    rows_used: Optional[int] = None
    fraud_rate: Optional[Decimal] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str
    error_message: Optional[str] = None
    model_config = {"from_attributes": True, "protected_namespaces": ()}


class ShapFeature(BaseModel):
    feature: str
    impact: float
    value: float
    direction: str
    note: Optional[str] = None


class MLPredictionOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    model_family: Optional[str] = None
    score: Optional[Decimal] = None
    band: Optional[str] = None
    confidence: Optional[Decimal] = None
    shap_values: Optional[List[Dict[str, Any]]] = None
    predicted_at: datetime
    model_version: Optional[str] = None
    note: Optional[str] = None
    model_config = {"from_attributes": True, "protected_namespaces": ()}


class ModelFeedbackOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    prediction_id: Optional[uuid.UUID] = None
    source: str
    rating: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class FeedbackRatingRequest(BaseModel):
    case_id: uuid.UUID
    prediction_id: Optional[uuid.UUID] = None
    rating: str   # accurate | inaccurate | uncertain
    note: Optional[str] = None


class MLOverview(BaseModel):
    champion: Optional[ModelRegistryOut] = None
    challenger_pending: Optional[ModelRegistryOut] = None
    override_rate_30d: float
    avg_confidence: Optional[float] = None
    total_predictions: int
    note: Optional[str] = None


class RetrainResponse(BaseModel):
    run_id: str
    model_registry_id: str
    version: str
    status: str
    rows_used: int
    fraud_rate: float
    precision: float
    recall: float
    f1_score: float
    auc_roc: float
    false_positive_rate: float
    note: str = "Challenger registered. Review metrics then promote via /api/ml/model-registry/{id}/promote"
