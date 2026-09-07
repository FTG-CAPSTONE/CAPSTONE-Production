from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator


class PartySummary(BaseModel):
    id: uuid.UUID
    full_name: str
    id_number: Optional[str] = None
    phone: Optional[str] = None
    county: Optional[str] = None
    model_config = {"from_attributes": True}


class PolicySummary(BaseModel):
    id: uuid.UUID
    external_id: Optional[str] = None
    product_line: str
    motor_class: Optional[str] = None
    sum_insured: Optional[Decimal] = None
    premium: Optional[Decimal] = None
    start_date: date
    end_date: date
    status: str
    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    id: uuid.UUID
    doc_type: str
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_at: datetime
    storage_path: str


class DocumentOut(BaseModel):
    id: uuid.UUID
    doc_type: str
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class CaseEventOut(BaseModel):
    id: uuid.UUID
    event_type: str
    actor: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    occurred_at: datetime
    model_config = {"from_attributes": True}


class RuleEvalOut(BaseModel):
    rule_code: str
    result: str
    severity: Optional[str] = None
    description: Optional[str] = None
    triggered_value: Optional[Dict[str, Any]] = None


class CaseListItem(BaseModel):
    id: uuid.UUID
    external_claim_id: Optional[str] = None
    case_type: str
    line_of_business: str
    claim_type: Optional[str] = None
    amount_claimed: Optional[Decimal] = None
    status: str
    fraud_score: Optional[Decimal] = None
    fraud_band: Optional[str] = None
    complexity_score: Optional[Decimal] = None
    confidence: Optional[Decimal] = None
    submitted_at: datetime
    model_config = {"from_attributes": True}


class CaseDetail(BaseModel):
    id: uuid.UUID
    external_claim_id: Optional[str] = None
    case_type: str
    line_of_business: str
    claim_type: Optional[str] = None
    amount_claimed: Optional[Decimal] = None
    amount_approved: Optional[Decimal] = None
    currency: str
    incident_date: Optional[date] = None
    reported_date: Optional[date] = None
    status: str
    fraud_score: Optional[Decimal] = None
    risk_score: Optional[Decimal] = None
    fraud_band: Optional[str] = None
    complexity_score: Optional[Decimal] = None
    confidence: Optional[Decimal] = None
    segment_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    submitted_at: datetime
    closed_at: Optional[datetime] = None
    policy: Optional[PolicySummary] = None
    claimant: Optional[PartySummary] = None
    provider: Optional[PartySummary] = None
    documents: List[DocumentOut] = []
    rule_evaluations: List[RuleEvalOut] = []
    audit_events: List[CaseEventOut] = []


class DecisionRequest(BaseModel):
    decision: str
    rationale: str

    @field_validator("decision")
    @classmethod
    def valid_decision(cls, v: str) -> str:
        valid = {"approved", "declined", "escalated", "request_docs"}
        if v not in valid:
            raise ValueError(f"Decision must be one of {sorted(valid)}")
        return v

    @field_validator("rationale")
    @classmethod
    def rationale_min_length(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Rationale must be at least 10 characters")
        return v.strip()


class DecisionResponse(BaseModel):
    case_id: uuid.UUID
    decision: str
    status: str
    decided_by: str


class SimilarCaseOut(BaseModel):
    id: uuid.UUID
    external_claim_id: Optional[str] = None
    claim_type: Optional[str] = None
    amount_claimed: Optional[Decimal] = None
    status: str
    submitted_at: datetime
    match_reason: str
