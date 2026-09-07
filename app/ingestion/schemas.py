from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class WebhookClaimPayload(BaseModel):
    claim_id: str
    policy_id: str
    claimant_id: str
    claim_type: str
    amount_claimed: str
    incident_date: str
    reported_date: str
    documents: List[str] = []
    ob_number: Optional[str] = None
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
    segment_data: Dict[str, Any] = {}


class SeedRequest(BaseModel):
    policyholders: int = Field(default=200, ge=10, le=5000)
    repairers: int = Field(default=20, ge=5, le=50)
    fraud_rate: float = Field(default=0.10, ge=0.0, le=0.50)
    seed: int = Field(default=42)


class SeedResponse(BaseModel):
    policyholders: int
    vehicles: int
    repairers: int
    policies: int
    claims: int
    fraud_injected: int
    seed_used: int
    batch_id: Optional[str] = None


class IngestLogOut(BaseModel):
    id: uuid.UUID
    batch_id: Optional[str]
    source: str
    row_count: int
    trusted_count: int
    corrected_count: int
    rejected_count: int
    ingested_at: datetime
    model_config = {"from_attributes": True}


class RawIntakeOut(BaseModel):
    id: uuid.UUID
    source: str
    external_ref: Optional[str]
    etl_status: str
    received_at: datetime
    model_config = {"from_attributes": True}


class ProcessResponse(BaseModel):
    raw_intake_id: uuid.UUID
    external_ref: str
    status: str
    message: str
