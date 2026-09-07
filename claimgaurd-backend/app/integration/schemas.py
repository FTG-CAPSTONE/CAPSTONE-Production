from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class PartyRecord(BaseModel):
    """InsureMaster party/client record — policyholder, claimant, or provider."""
    party_id: str
    party_type: str          # individual | corporate | provider
    full_name: str
    id_number: Optional[str] = None
    kra_pin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    county: Optional[str] = None


class VehicleRecord(BaseModel):
    """InsureMaster vehicle asset record."""
    vehicle_id: str
    registration: str
    make: str
    model: str
    year: int
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    body_type: str = "Saloon"
    color: Optional[str] = None
    use_type: str = "private"   # private | psv | commercial


class PolicyRecord(BaseModel):
    """InsureMaster policy record."""
    policy_id: str
    policyholder_id: str
    vehicle_id: Optional[str] = None
    product_line: str           # motor | health | marine_cargo | general
    motor_class: Optional[str] = None  # comprehensive | third_party | tpft
    sum_insured: Decimal
    premium: Decimal
    start_date: date
    end_date: date
    status: str = "active"
    agent_code: Optional[str] = None
    branch_code: Optional[str] = None


class ClaimRecord(BaseModel):
    """InsureMaster claim record — the primary input to ClaimGuard's ETL pipeline."""
    claim_id: str
    policy_id: str
    claimant_id: str
    claim_type: str             # own_damage | third_party | theft | medical | windscreen
    amount_claimed: Decimal
    incident_date: date
    reported_date: date
    documents: List[str] = []   # list of document type codes present
    ob_number: Optional[str] = None
    provider_id: Optional[str] = None
    provider_name: Optional[str] = None
    segment_data: Dict[str, Any] = {}


class AgentRecord(BaseModel):
    """InsureMaster agent/branch record."""
    agent_code: str
    agent_name: str
    branch_code: str
    branch_name: str
    county: Optional[str] = None
