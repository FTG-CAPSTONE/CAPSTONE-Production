from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Party(Base):
    __tablename__ = "party"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(200), index=True)
    party_type: Mapped[str] = mapped_column(String(50), nullable=False)  # individual|corporate|provider
    full_name: Mapped[str] = mapped_column(String(300), nullable=False)
    id_number: Mapped[str | None] = mapped_column(String(50), index=True)
    phone: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(200))
    county: Mapped[str | None] = mapped_column(String(100))
    kra_pin: Mapped[str | None] = mapped_column(String(20), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Vehicle(Base):
    __tablename__ = "vehicle"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(200), index=True)
    party_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"))
    registration: Mapped[str | None] = mapped_column(String(30), unique=True, index=True)
    make: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    year: Mapped[int | None] = mapped_column(Integer)
    chassis_number: Mapped[str | None] = mapped_column(String(100))
    engine_number: Mapped[str | None] = mapped_column(String(100))
    body_type: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(50))
    use_type: Mapped[str | None] = mapped_column(String(50))  # private|psv|commercial


class Policy(Base):
    __tablename__ = "policy"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(200), unique=True, index=True)
    policyholder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"))
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicle.id"))
    product_line: Mapped[str] = mapped_column(String(50), nullable=False)
    motor_class: Mapped[str | None] = mapped_column(String(50))
    sum_insured: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    premium: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    agent_code: Mapped[str | None] = mapped_column(String(50))
    branch_code: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="active")

    # Relationships
    vehicle: Mapped[Vehicle | None] = relationship("Vehicle", foreign_keys=[vehicle_id])


class Case(Base):
    __tablename__ = "case"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_type: Mapped[str] = mapped_column(String(30), nullable=False)   # claim|application
    line_of_business: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    claim_type: Mapped[str | None] = mapped_column(String(50))
    external_claim_id: Mapped[str | None] = mapped_column(String(200), unique=True, index=True)
    policy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("policy.id"))
    claimant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"))
    provider_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"))
    amount_claimed: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    amount_approved: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(10), default="KES")
    incident_date: Mapped[date | None] = mapped_column(Date)
    reported_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="received", index=True)
    fraud_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    risk_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    fraud_band: Mapped[str | None] = mapped_column(String(20))
    complexity_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    confidence: Mapped[Decimal | None] = mapped_column(Numeric(5, 4))
    segment_data: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    policy: Mapped[Policy | None] = relationship("Policy", foreign_keys=[policy_id])
    claimant: Mapped[Party | None] = relationship("Party", foreign_keys=[claimant_id])
    provider: Mapped[Party | None] = relationship("Party", foreign_keys=[provider_id])
    line_items: Mapped[list[CaseLineItem]] = relationship("CaseLineItem", back_populates="case")
    documents: Mapped[list[Document]] = relationship("Document", back_populates="case")
    events: Mapped[list[CaseEvent]] = relationship(
        "CaseEvent", back_populates="case", order_by="CaseEvent.occurred_at"
    )


class CaseLineItem(Base):
    __tablename__ = "case_line_item"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("case.id"), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    amount: Mapped[Decimal | None] = mapped_column(Numeric(15, 2))
    item_type: Mapped[str | None] = mapped_column(String(50))

    case: Mapped[Case] = relationship("Case", back_populates="line_items")


class Document(Base):
    __tablename__ = "document"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("case.id"), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(300))
    mime_type: Mapped[str | None] = mapped_column(String(100))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    checksum: Mapped[str | None] = mapped_column(String(64))
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id")
    )

    case: Mapped[Case] = relationship("Case", back_populates="documents")


class CaseEvent(Base):
    """Immutable audit trail — append only, no UPDATE/DELETE endpoints."""
    __tablename__ = "case_event"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case.id"), nullable=False, index=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor: Mapped[str | None] = mapped_column(String(100))
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("app_user.id"))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    case: Mapped[Case] = relationship("Case", back_populates="events")
