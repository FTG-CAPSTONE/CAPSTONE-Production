from __future__ import annotations

import uuid
from typing import Annotated, List

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from app.core.config import settings
from app.core.deps import AdminOnly, CurrentUser, DBSession, Pagination
from app.ingestion import crud as ingestion_crud
from app.ingestion.schemas import (
    IngestLogOut, ProcessResponse, RawIntakeOut, SeedRequest, SeedResponse, WebhookClaimPayload,
)

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


@router.post("/insuremaster/claims", status_code=status.HTTP_202_ACCEPTED)
async def insuremaster_webhook(
    payload: WebhookClaimPayload, db: DBSession, background_tasks: BackgroundTasks
):
    existing = await ingestion_crud.get_raw_intake_by_ref(db, payload.claim_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"Claim '{payload.claim_id}' already received")
    intake = await ingestion_crud.create_raw_intake(
        db, source="webhook", external_ref=payload.claim_id, raw_payload=payload.model_dump()
    )
    background_tasks.add_task(_trigger_etl, str(intake.id))
    return {"intake_id": str(intake.id), "claim_id": payload.claim_id, "status": "accepted"}


@router.post("/dev/seed", response_model=SeedResponse)
async def dev_seed(
    req: SeedRequest, db: DBSession, background_tasks: BackgroundTasks,
    _: Annotated[None, AdminOnly],
):
    if not settings.ENABLE_DEV_SEED_ENDPOINT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Dev seed endpoint is disabled in this environment.")
    import asyncio
    loop = asyncio.get_event_loop()
    stats = await loop.run_in_executor(None, _run_seed, req.policyholders, req.repairers, req.fraud_rate, req.seed)
    return SeedResponse(**stats)


def _run_seed(n_policyholders, n_repairers, fraud_rate, seed):
    from synth.seed_cli import run as seed_run
    return seed_run(n_policyholders=n_policyholders, n_repairers=n_repairers,
                    fraud_rate=fraud_rate, seed=seed, dry_run=False, verbose=False)


@router.post("/claims/{external_ref}/process", response_model=ProcessResponse)
async def process_claim(
    external_ref: str, db: DBSession, background_tasks: BackgroundTasks,
    _: Annotated[None, AdminOnly],
):
    intake = await ingestion_crud.get_raw_intake_by_ref(db, external_ref)
    if not intake:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No intake record found for claim '{external_ref}'")
    if intake.etl_status in ("processing", "done"):
        return ProcessResponse(raw_intake_id=intake.id, external_ref=external_ref,
                               status=intake.etl_status, message=f"Claim already {intake.etl_status}")
    background_tasks.add_task(_trigger_etl, str(intake.id))
    return ProcessResponse(raw_intake_id=intake.id, external_ref=external_ref,
                           status="queued", message="ETL pipeline triggered")


@router.post("/batch/process-pending")
async def process_all_pending(
    db: DBSession, background_tasks: BackgroundTasks, _: Annotated[None, AdminOnly]
):
    pending = await ingestion_crud.get_pending_intakes(db, limit=500)
    for intake in pending:
        background_tasks.add_task(_trigger_etl, str(intake.id))
    return {"queued": len(pending)}


@router.get("/dev/claims", response_model=List[RawIntakeOut])
async def list_dev_claims(db: DBSession, pagination: Pagination, _: Annotated[None, AdminOnly]):
    if not settings.ENABLE_DEV_SEED_ENDPOINT:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev endpoint disabled")
    return await ingestion_crud.list_raw_intakes(db, skip=pagination["skip"], limit=pagination["limit"])


@router.get("/logs", response_model=List[IngestLogOut])
async def list_ingest_logs(db: DBSession, pagination: Pagination, _: Annotated[None, AdminOnly]):
    return await ingestion_crud.get_ingest_logs(db, skip=pagination["skip"], limit=pagination["limit"])


def _trigger_etl(intake_id: str) -> None:
    try:
        from app.etl.tasks import process_intake
        process_intake.delay(intake_id)
    except Exception:
        from app.etl.tasks import run_etl_sync
        run_etl_sync(intake_id)
