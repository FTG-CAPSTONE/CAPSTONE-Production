from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import case as sa_case, func, select

from app.cases.models import Case, Party
from app.core.deps import AdminOnly, CurrentUser, DBSession

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AnalyticsOverview(BaseModel):
    total_cases: int
    auto_approved: int
    auto_rejected: int
    in_review: int
    approved: int
    declined: int
    auto_decision_rate: float
    avg_fraud_score: Optional[float]
    current_champion_model: Optional[str]
    cases_by_lob: Dict[str, int]
    cases_by_status: Dict[str, int]
    estimated_fraud_savings_kes: float
    sla_compliance_rate: float
    sla_at_risk: int          # cases >= 60 days open
    sla_breached: int         # cases >= 90 days open


class FraudTrendPoint(BaseModel):
    date: str
    avg_score: float
    case_count: int


class ProviderRiskRow(BaseModel):
    provider_name: str
    total_claims: int
    total_amount: float
    avg_amount: float
    fraud_rate: float
    declined_count: int


class SLAComplianceMonth(BaseModel):
    month: str           # e.g. "2026-08"
    total_closed: int
    within_sla: int
    compliance_rate: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=AnalyticsOverview)
async def analytics_overview(db: DBSession, current_user: CurrentUser):
    status_result = await db.execute(
        select(Case.status, func.count(Case.id)).group_by(Case.status)
    )
    by_status: Dict[str, int] = {row[0]: row[1] for row in status_result.all()}

    lob_result = await db.execute(
        select(Case.line_of_business, func.count(Case.id)).group_by(Case.line_of_business)
    )
    by_lob: Dict[str, int] = {row[0]: row[1] for row in lob_result.all()}

    total = sum(by_status.values())
    auto_approved = by_status.get("auto_approved", 0)
    auto_rejected = by_status.get("auto_rejected", 0)
    in_review     = by_status.get("in_review", 0)
    approved      = by_status.get("approved", 0)
    declined      = by_status.get("declined", 0)
    auto_rate = round((auto_approved + auto_rejected) / total, 4) if total > 0 else 0.0

    avg_res = await db.execute(
        select(func.avg(Case.fraud_score)).where(Case.fraud_score.isnot(None))
    )
    avg_fraud = avg_res.scalar_one_or_none()

    savings_res = await db.execute(
        select(func.sum(Case.amount_claimed)).where(Case.status == "declined")
    )
    estimated_savings = float(savings_res.scalar_one_or_none() or 0) * 0.75

    from app.ml.models import ModelRegistry
    champ_res = await db.execute(
        select(ModelRegistry.version)
        .where(ModelRegistry.status == "champion")
        .where(ModelRegistry.model_family == "claims_fraud")
        .limit(1)
    )
    champion = champ_res.scalar_one_or_none()

    # SLA metrics
    sla_res = await db.execute(
        select(
            func.count(Case.id).label("total_closed"),
            func.sum(sa_case(
                (func.extract("epoch", Case.closed_at - Case.submitted_at) / 86400 <= 90, 1),
                else_=0,
            )).label("within_sla"),
        ).where(Case.closed_at.isnot(None))
    )
    sla_row = sla_res.one_or_none()
    if sla_row and sla_row.total_closed and sla_row.total_closed > 0:
        sla_rate = round(float(sla_row.within_sla or 0) / float(sla_row.total_closed), 4)
    else:
        sla_rate = 1.0

    # Cases approaching / past 90-day deadline
    now = datetime.now(timezone.utc)
    amber_threshold = now - timedelta(days=60)
    breach_threshold = now - timedelta(days=90)
    OPEN = ("received", "processing", "in_review")

    at_risk_res = await db.execute(
        select(func.count(Case.id))
        .where(Case.status.in_(OPEN))
        .where(Case.submitted_at <= amber_threshold)
    )
    sla_at_risk = at_risk_res.scalar_one() or 0

    breached_res = await db.execute(
        select(func.count(Case.id))
        .where(Case.status.in_(OPEN))
        .where(Case.submitted_at <= breach_threshold)
    )
    sla_breached = breached_res.scalar_one() or 0

    return AnalyticsOverview(
        total_cases=total, auto_approved=auto_approved, auto_rejected=auto_rejected,
        in_review=in_review, approved=approved, declined=declined,
        auto_decision_rate=auto_rate,
        avg_fraud_score=round(float(avg_fraud), 2) if avg_fraud else None,
        current_champion_model=champion, cases_by_lob=by_lob, cases_by_status=by_status,
        estimated_fraud_savings_kes=round(estimated_savings, 2),
        sla_compliance_rate=sla_rate,
        sla_at_risk=sla_at_risk,
        sla_breached=sla_breached,
    )


@router.get("/fraud-trend", response_model=List[FraudTrendPoint])
async def fraud_trend(
    db: DBSession,
    current_user: CurrentUser,
    days: int = Query(default=30, ge=7, le=180),
):
    """Rolling daily average fraud score over the last N days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await db.execute(
        select(
            func.date_trunc("day", Case.submitted_at).label("day"),
            func.avg(Case.fraud_score).label("avg_score"),
            func.count(Case.id).label("case_count"),
        )
        .where(Case.submitted_at >= since)
        .where(Case.fraud_score.isnot(None))
        .group_by("day")
        .order_by("day")
    )

    return [
        FraudTrendPoint(
            date=row.day.strftime("%Y-%m-%d"),
            avg_score=round(float(row.avg_score), 2),
            case_count=row.case_count,
        )
        for row in rows.all()
    ]


@router.get("/sla-compliance", response_model=List[SLAComplianceMonth])
async def sla_compliance(
    db: DBSession,
    current_user: CurrentUser,
    months: int = Query(default=6, ge=1, le=24),
):
    """Monthly SLA compliance rate (% closed within 90 days)."""
    since = datetime.now(timezone.utc) - timedelta(days=months * 31)

    rows = await db.execute(
        select(
            func.to_char(Case.closed_at, "YYYY-MM").label("month"),
            func.count(Case.id).label("total_closed"),
            func.sum(sa_case(
                (func.extract("epoch", Case.closed_at - Case.submitted_at) / 86400 <= 90, 1),
                else_=0,
            )).label("within_sla"),
        )
        .where(Case.closed_at.isnot(None))
        .where(Case.closed_at >= since)
        .group_by("month")
        .order_by("month")
    )

    result = []
    for row in rows.all():
        tc = int(row.total_closed)
        ws = int(row.within_sla or 0)
        result.append(SLAComplianceMonth(
            month=row.month,
            total_closed=tc,
            within_sla=ws,
            compliance_rate=round(ws / tc, 4) if tc > 0 else 1.0,
        ))
    return result


@router.get("/provider-heatmap", response_model=List[ProviderRiskRow])
async def provider_heatmap(
    db: DBSession,
    current_user: CurrentUser,
    limit: int = Query(default=20, le=100),
):
    """
    Provider (repairer) risk profile — aggregated from case history.
    Sorted by total claims descending.
    """
    rows = await db.execute(
        select(
            Party.full_name.label("provider_name"),
            func.count(Case.id).label("total_claims"),
            func.sum(Case.amount_claimed).label("total_amount"),
            func.avg(Case.amount_claimed).label("avg_amount"),
            func.sum(sa_case((Case.status == "declined", 1), else_=0)).label("declined_count"),
        )
        .join(Party, Case.provider_id == Party.id)
        .where(Party.party_type == "provider")
        .group_by(Party.full_name)
        .order_by(func.count(Case.id).desc())
        .limit(limit)
    )

    result = []
    for row in rows.all():
        tc = int(row.total_claims)
        dc = int(row.declined_count or 0)
        result.append(ProviderRiskRow(
            provider_name=row.provider_name,
            total_claims=tc,
            total_amount=round(float(row.total_amount or 0), 2),
            avg_amount=round(float(row.avg_amount or 0), 2),
            fraud_rate=round(dc / tc, 4) if tc > 0 else 0.0,
            declined_count=dc,
        ))
    return result


@router.post("/run-alerts", summary="Manually trigger SLA + override rate checks")
async def run_alerts_now(
    current_user: CurrentUser,
):
    """Admin endpoint to trigger alert evaluation immediately (without Celery Beat)."""
    from app.core.deps import require_roles
    # Role check inline (AdminOnly is a Depends factory, not usable as a direct param here)
    if current_user.role not in ("admin", "ml_admin"):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    """Admin endpoint to trigger alert evaluation immediately (without Celery Beat)."""
    import asyncio

    loop = asyncio.get_event_loop()

    from app.analytics.tasks import (
        check_sla_breaches_sync,
        check_override_rate_sync,
        check_queue_backlog_sync,
    )

    sla    = await loop.run_in_executor(None, check_sla_breaches_sync)
    ovr    = await loop.run_in_executor(None, check_override_rate_sync)
    backlog= await loop.run_in_executor(None, check_queue_backlog_sync)

    return {"sla": sla, "override_rate": ovr, "queue_backlog": backlog}
