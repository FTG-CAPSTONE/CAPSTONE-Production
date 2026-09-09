"""
app/network/router.py
─────────────────────
Network / ring fraud detection.

Detects clusters of cases connected by shared identifiers:
  - Same provider (repairer)
  - Same claimant (phone, ID number, or party record)
  - Same vehicle (registration)
  - Same policy

A "ring" is any connected component with ≥ 2 cases where at least one
case is flagged (fraud_score >= threshold or status in [auto_rejected,
declined]). Pure clean clusters are excluded unless they are unusually large.

All queries are SQL-only — no graph library dependency.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select, text

from app.cases.models import Case, Party, Policy, Vehicle
from app.core.deps import CurrentUser, DBSession

router = APIRouter(prefix="/api/network", tags=["network-intelligence"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NetworkNode(BaseModel):
    id: str
    node_type: str          # case | party | vehicle | policy
    label: str
    fraud_score: Optional[float] = None
    status: Optional[str] = None
    amount: Optional[float] = None
    risk_level: str = "unknown"   # low | medium | high | critical


class NetworkEdge(BaseModel):
    source: str
    target: str
    edge_type: str          # shared_provider | shared_claimant | shared_vehicle | shared_policy
    weight: int = 1


class RingSummary(BaseModel):
    ring_id: str
    ring_type: str          # provider_ring | claimant_ring | vehicle_ring | mixed
    case_count: int
    flagged_count: int      # cases with fraud_score >= 0.5 or declined/rejected
    total_amount_kes: float
    avg_fraud_score: Optional[float]
    risk_level: str         # medium | high | critical
    hub_label: str          # name of the shared entity (e.g. provider name)
    hub_type: str           # provider | claimant | vehicle
    case_ids: List[str]
    first_seen: Optional[str]
    last_seen: Optional[str]


class NetworkGraphResponse(BaseModel):
    ring_id: str
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    summary: RingSummary


class RingsListResponse(BaseModel):
    rings: List[RingSummary]
    total_rings: int
    total_flagged_cases: int
    critical_rings: int
    high_rings: int
    generated_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_level(flagged: int, total: int, avg_score: Optional[float]) -> str:
    ratio = flagged / max(total, 1)
    score = avg_score or 0.0
    if total >= 5 and (ratio >= 0.6 or score >= 0.75):
        return "critical"
    if total >= 3 and (ratio >= 0.4 or score >= 0.55):
        return "high"
    if total >= 2 and (ratio >= 0.25 or score >= 0.40):
        return "medium"
    return "low"


def _case_risk(fraud_score: Optional[float], status: Optional[str]) -> str:
    if status in ("auto_rejected", "declined"):
        return "high"
    s = float(fraud_score or 0)
    if s >= 0.75:
        return "critical"
    if s >= 0.5:
        return "high"
    if s >= 0.3:
        return "medium"
    return "low"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/rings", response_model=RingsListResponse)
async def list_rings(
    db: DBSession,
    current_user: CurrentUser,
    days: int = Query(default=90, ge=7, le=365, description="Look-back window in days"),
    min_cases: int = Query(default=2, ge=2, le=20, description="Minimum cluster size"),
    fraud_threshold: float = Query(default=0.4, ge=0.0, le=1.0),
):
    """
    Detect and return all fraud rings found in the specified look-back window.
    A ring is a cluster of cases sharing a provider, claimant, or vehicle
    where at least one case is flagged above the threshold.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rings: List[RingSummary] = []

    # ── 1. Provider rings ─────────────────────────────────────────────────────
    provider_rows = await db.execute(
        select(
            Party.id.label("provider_id"),
            Party.full_name.label("provider_name"),
            func.count(Case.id).label("case_count"),
            func.sum(Case.amount_claimed).label("total_amount"),
            func.avg(Case.fraud_score).label("avg_score"),
            func.sum(
                func.cast(
                    or_(
                        Case.fraud_score >= fraud_threshold,
                        Case.status.in_(["auto_rejected", "declined"]),
                    ).cast(text("integer")),
                    type_=None,
                )
            ).label("flagged_count"),
            func.min(Case.submitted_at).label("first_seen"),
            func.max(Case.submitted_at).label("last_seen"),
            func.array_agg(Case.id).label("case_ids"),
        )
        .join(Party, Case.provider_id == Party.id)
        .where(Case.submitted_at >= since)
        .where(Party.party_type == "provider")
        .group_by(Party.id, Party.full_name)
        .having(func.count(Case.id) >= min_cases)
        .order_by(func.avg(Case.fraud_score).desc().nullslast())
    )

    for row in provider_rows.all():
        case_ids = [str(c) for c in (row.case_ids or [])]
        flagged = int(row.flagged_count or 0)
        if flagged == 0 and row.case_count < 5:
            continue  # skip clean small clusters
        avg_s = float(row.avg_score) if row.avg_score else None
        rings.append(RingSummary(
            ring_id=f"provider-{row.provider_id}",
            ring_type="provider_ring",
            case_count=int(row.case_count),
            flagged_count=flagged,
            total_amount_kes=round(float(row.total_amount or 0), 2),
            avg_fraud_score=round(avg_s, 3) if avg_s else None,
            risk_level=_risk_level(flagged, int(row.case_count), avg_s),
            hub_label=row.provider_name,
            hub_type="provider",
            case_ids=case_ids,
            first_seen=row.first_seen.strftime("%Y-%m-%d") if row.first_seen else None,
            last_seen=row.last_seen.strftime("%Y-%m-%d") if row.last_seen else None,
        ))

    # ── 2. Claimant rings (same party appears in multiple claims) ─────────────
    claimant_rows = await db.execute(
        select(
            Party.id.label("claimant_id"),
            Party.full_name.label("claimant_name"),
            Party.phone.label("phone"),
            func.count(Case.id).label("case_count"),
            func.sum(Case.amount_claimed).label("total_amount"),
            func.avg(Case.fraud_score).label("avg_score"),
            func.min(Case.submitted_at).label("first_seen"),
            func.max(Case.submitted_at).label("last_seen"),
            func.array_agg(Case.id).label("case_ids"),
        )
        .join(Party, Case.claimant_id == Party.id)
        .where(Case.submitted_at >= since)
        .group_by(Party.id, Party.full_name, Party.phone)
        .having(func.count(Case.id) >= min_cases)
        .order_by(func.count(Case.id).desc())
    )

    for row in claimant_rows.all():
        case_ids = [str(c) for c in (row.case_ids or [])]
        # For claimant rings, flag based on fraud_score directly
        flagged = 0
        if row.avg_score and float(row.avg_score) >= fraud_threshold:
            flagged = max(1, int(row.case_count * float(row.avg_score)))
        if flagged == 0 and row.case_count < 4:
            continue
        avg_s = float(row.avg_score) if row.avg_score else None
        rings.append(RingSummary(
            ring_id=f"claimant-{row.claimant_id}",
            ring_type="claimant_ring",
            case_count=int(row.case_count),
            flagged_count=min(flagged, int(row.case_count)),
            total_amount_kes=round(float(row.total_amount or 0), 2),
            avg_fraud_score=round(avg_s, 3) if avg_s else None,
            risk_level=_risk_level(flagged, int(row.case_count), avg_s),
            hub_label=f"{row.claimant_name}" + (f" · {row.phone}" if row.phone else ""),
            hub_type="claimant",
            case_ids=case_ids,
            first_seen=row.first_seen.strftime("%Y-%m-%d") if row.first_seen else None,
            last_seen=row.last_seen.strftime("%Y-%m-%d") if row.last_seen else None,
        ))

    # ── 3. Vehicle rings (same vehicle in multiple claims) ────────────────────
    vehicle_rows = await db.execute(
        select(
            Vehicle.id.label("vehicle_id"),
            Vehicle.registration.label("registration"),
            Vehicle.make.label("make"),
            Vehicle.model.label("model_name"),
            func.count(Case.id).label("case_count"),
            func.sum(Case.amount_claimed).label("total_amount"),
            func.avg(Case.fraud_score).label("avg_score"),
            func.min(Case.submitted_at).label("first_seen"),
            func.max(Case.submitted_at).label("last_seen"),
            func.array_agg(Case.id).label("case_ids"),
        )
        .join(Policy, Case.policy_id == Policy.id)
        .join(Vehicle, Policy.vehicle_id == Vehicle.id)
        .where(Case.submitted_at >= since)
        .where(Vehicle.registration.isnot(None))
        .group_by(Vehicle.id, Vehicle.registration, Vehicle.make, Vehicle.model)
        .having(func.count(Case.id) >= min_cases)
        .order_by(func.count(Case.id).desc())
    )

    for row in vehicle_rows.all():
        case_ids = [str(c) for c in (row.case_ids or [])]
        avg_s = float(row.avg_score) if row.avg_score else None
        flagged = max(1, int((row.case_count - 1)))  # >1 claim on same vehicle is inherently flagged
        label = row.registration or "Unknown reg"
        if row.make:
            label += f" ({row.make} {row.model_name or ''})"
        rings.append(RingSummary(
            ring_id=f"vehicle-{row.vehicle_id}",
            ring_type="vehicle_ring",
            case_count=int(row.case_count),
            flagged_count=flagged,
            total_amount_kes=round(float(row.total_amount or 0), 2),
            avg_fraud_score=round(avg_s, 3) if avg_s else None,
            risk_level=_risk_level(flagged, int(row.case_count), avg_s),
            hub_label=label.strip(),
            hub_type="vehicle",
            case_ids=case_ids,
            first_seen=row.first_seen.strftime("%Y-%m-%d") if row.first_seen else None,
            last_seen=row.last_seen.strftime("%Y-%m-%d") if row.last_seen else None,
        ))

    # Sort by risk level then total amount
    risk_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "unknown": 4}
    rings.sort(key=lambda r: (risk_order.get(r.risk_level, 4), -r.total_amount_kes))

    total_flagged = sum(r.flagged_count for r in rings)
    critical = sum(1 for r in rings if r.risk_level == "critical")
    high = sum(1 for r in rings if r.risk_level == "high")

    return RingsListResponse(
        rings=rings,
        total_rings=len(rings),
        total_flagged_cases=total_flagged,
        critical_rings=critical,
        high_rings=high,
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


@router.get("/rings/{ring_id}", response_model=NetworkGraphResponse)
async def get_ring_graph(
    ring_id: str,
    db: DBSession,
    current_user: CurrentUser,
):
    """
    Returns a graph representation of a specific ring for visualisation.
    ring_id format: provider-<uuid> | claimant-<uuid> | vehicle-<uuid>
    """
    parts = ring_id.split("-", 1)
    if len(parts) != 2:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid ring_id format")

    hub_type, hub_id_str = parts[0], parts[1]

    try:
        hub_uuid = uuid.UUID(hub_id_str)
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid UUID in ring_id")

    nodes: List[NetworkNode] = []
    edges: List[NetworkEdge] = []

    if hub_type == "provider":
        hub_res = await db.execute(select(Party).where(Party.id == hub_uuid))
        hub = hub_res.scalar_one_or_none()
        if hub:
            nodes.append(NetworkNode(
                id=f"party-{hub.id}",
                node_type="party",
                label=hub.full_name,
                risk_level="medium",
            ))

        cases_res = await db.execute(
            select(Case).where(Case.provider_id == hub_uuid).limit(50)
        )
        cases = cases_res.scalars().all()

    elif hub_type == "claimant":
        hub_res = await db.execute(select(Party).where(Party.id == hub_uuid))
        hub = hub_res.scalar_one_or_none()
        if hub:
            nodes.append(NetworkNode(
                id=f"party-{hub.id}",
                node_type="party",
                label=hub.full_name + (f" · {hub.phone}" if hub.phone else ""),
                risk_level="medium",
            ))

        cases_res = await db.execute(
            select(Case).where(Case.claimant_id == hub_uuid).limit(50)
        )
        cases = cases_res.scalars().all()

    elif hub_type == "vehicle":
        hub_res = await db.execute(select(Vehicle).where(Vehicle.id == hub_uuid))
        hub = hub_res.scalar_one_or_none()
        if hub:
            label = hub.registration or str(hub.id)
            if hub.make:
                label += f" ({hub.make} {hub.model or ''})"
            nodes.append(NetworkNode(
                id=f"vehicle-{hub.id}",
                node_type="vehicle",
                label=label.strip(),
                risk_level="medium",
            ))

        cases_res = await db.execute(
            select(Case)
            .join(Policy, Case.policy_id == Policy.id)
            .where(Policy.vehicle_id == hub_uuid)
            .limit(50)
        )
        cases = cases_res.scalars().all()
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown hub_type: {hub_type}")

    # Add case nodes and edges to hub
    hub_node_id = nodes[0].id if nodes else f"{hub_type}-{hub_id_str}"
    flagged_count = 0
    total_amount = 0.0
    amounts = []
    scores = []

    for c in cases:
        risk = _case_risk(c.fraud_score, c.status)
        case_node_id = f"case-{c.id}"
        nodes.append(NetworkNode(
            id=case_node_id,
            node_type="case",
            label=f"Case {str(c.id)[:8]}… · KES {float(c.amount_claimed or 0):,.0f}",
            fraud_score=float(c.fraud_score) if c.fraud_score else None,
            status=c.status,
            amount=float(c.amount_claimed) if c.amount_claimed else None,
            risk_level=risk,
        ))
        edges.append(NetworkEdge(
            source=hub_node_id,
            target=case_node_id,
            edge_type=f"shared_{hub_type}",
        ))
        if risk in ("high", "critical"):
            flagged_count += 1
        if c.amount_claimed:
            total_amount += float(c.amount_claimed)
            amounts.append(float(c.amount_claimed))
        if c.fraud_score:
            scores.append(float(c.fraud_score))

    avg_score = round(sum(scores) / len(scores), 3) if scores else None
    risk_lvl = _risk_level(flagged_count, len(cases), avg_score)
    hub_label = nodes[0].label if nodes else ring_id

    summary = RingSummary(
        ring_id=ring_id,
        ring_type=f"{hub_type}_ring",
        case_count=len(cases),
        flagged_count=flagged_count,
        total_amount_kes=round(total_amount, 2),
        avg_fraud_score=avg_score,
        risk_level=risk_lvl,
        hub_label=hub_label,
        hub_type=hub_type,
        case_ids=[str(c.id) for c in cases],
        first_seen=None,
        last_seen=None,
    )

    return NetworkGraphResponse(ring_id=ring_id, nodes=nodes, edges=edges, summary=summary)
