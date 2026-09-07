from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class QueueItemOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    priority_score: Optional[Decimal] = None
    reason: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    assigned_username: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Denormalised case fields for fast queue rendering
    claim_type: Optional[str] = None
    amount_claimed: Optional[Decimal] = None
    fraud_score: Optional[Decimal] = None
    fraud_band: Optional[str] = None
    complexity_score: Optional[Decimal] = None
    model_config = {"from_attributes": True}


class AssignRequest(BaseModel):
    assigned_to: Optional[uuid.UUID] = None   # None = unassign


class InvestigationCreate(BaseModel):
    case_id: uuid.UUID
    notes: Optional[str] = None


class InvestigationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    findings: Optional[Dict[str, Any]] = None


class InvestigationClose(BaseModel):
    outcome: str        # fraud_confirmed | legitimate | inconclusive
    notes: Optional[str] = None
    findings: Optional[Dict[str, Any]] = None


class InvestigationOut(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    investigator_id: Optional[uuid.UUID] = None
    investigator_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    findings: Optional[Dict[str, Any]] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    outcome: Optional[str] = None
    model_config = {"from_attributes": True}
