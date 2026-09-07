from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class FeatureSnapshot(Base):
    """The exact feature vector used for an ML prediction — enables lineage."""
    __tablename__ = "feature_snapshot"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case.id"), nullable=False, index=True
    )
    features: Mapped[dict] = mapped_column(JSONB, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_family: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    algorithm: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="challenger", index=True)
    artifact_path: Mapped[str | None] = mapped_column(Text)
    feature_names: Mapped[list | None] = mapped_column(JSONB)
    precision: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    recall: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    f1_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    auc_roc: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    false_positive_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    trained_rows: Mapped[int | None] = mapped_column(Integer)
    promoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    promoted_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("app_user.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    training_runs: Mapped[list[TrainingRun]] = relationship("TrainingRun", back_populates="model")


class TrainingRun(Base):
    __tablename__ = "training_run"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_registry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_registry.id")
    )
    triggered_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("app_user.id"))
    rows_used: Mapped[int | None] = mapped_column(Integer)
    fraud_rate: Mapped[Decimal | None] = mapped_column(Numeric(6, 4))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="running")
    error_message: Mapped[str | None] = mapped_column(Text)

    model: Mapped[ModelRegistry | None] = relationship("ModelRegistry", back_populates="training_runs")


class MLPrediction(Base):
    __tablename__ = "ml_prediction"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case.id"), nullable=False, index=True
    )
    model_registry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_registry.id")
    )
    feature_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feature_snapshot.id")
    )
    model_family: Mapped[str | None] = mapped_column(String(50))
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    band: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    shap_values: Mapped[list | None] = mapped_column(JSONB)
    predicted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    model: Mapped[ModelRegistry | None] = relationship("ModelRegistry")
    feature_snapshot: Mapped[FeatureSnapshot | None] = relationship("FeatureSnapshot")


class ModelFeedback(Base):
    __tablename__ = "model_feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case.id"), nullable=False, index=True
    )
    prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ml_prediction.id")
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    rating: Mapped[str | None] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
