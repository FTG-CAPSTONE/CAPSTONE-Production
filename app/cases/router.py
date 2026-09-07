from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Annotated, List, Optional

from fastapi import (
    APIRouter, File, Form, HTTPException, Query, UploadFile, status
)
from fastapi.responses import Response, StreamingResponse

from app.cases import crud as cases_crud
from app.cases.schemas import (
    CaseDetail, CaseEventOut, CaseListItem, DecisionRequest,
    DecisionResponse, DocumentOut, DocumentUploadResponse,
    PartySummary, PolicySummary, RuleEvalOut, SimilarCaseOut,
)
from app.core.deps import AdjusterPlus, CurrentUser, DBSession, Pagination

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get("", response_model=List[CaseListItem])
async def list_cases(
    db: DBSession, current_user: CurrentUser, pagination: Pagination,
    status: Optional[str] = Query(None),
    line_of_business: Optional[str] = Query(None),
    claim_type: Optional[str] = Query(None),
):
    return await cases_crud.list_cases(
        db, skip=pagination["skip"], limit=pagination["limit"],
        status=status, line_of_business=line_of_business, claim_type=claim_type,
    )


@router.get("/{case_id}", response_model=CaseDetail)
async def get_case(case_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    case = await cases_crud.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    rule_evals = await cases_crud.get_rule_evaluations(db, case_id)
    return CaseDetail(
        id=case.id, external_claim_id=case.external_claim_id, case_type=case.case_type,
        line_of_business=case.line_of_business, claim_type=case.claim_type,
        amount_claimed=case.amount_claimed, amount_approved=case.amount_approved,
        currency=case.currency, incident_date=case.incident_date, reported_date=case.reported_date,
        status=case.status, fraud_score=case.fraud_score, risk_score=case.risk_score,
        fraud_band=case.fraud_band, complexity_score=case.complexity_score, confidence=case.confidence,
        segment_data=case.segment_data, notes=case.notes, submitted_at=case.submitted_at,
        closed_at=case.closed_at,
        policy=PolicySummary.model_validate(case.policy) if case.policy else None,
        claimant=PartySummary.model_validate(case.claimant) if case.claimant else None,
        provider=PartySummary.model_validate(case.provider) if case.provider else None,
        documents=[DocumentOut.model_validate(d) for d in case.documents],
        rule_evaluations=[
            RuleEvalOut(rule_code=r.rule_code, result=r.result, severity=r.severity,
                        description=r.description, triggered_value=r.triggered_value)
            for r in rule_evals
        ],
        audit_events=[
            CaseEventOut(id=e.id, event_type=e.event_type, actor=e.actor,
                         payload=e.payload, occurred_at=e.occurred_at)
            for e in sorted(case.events, key=lambda x: x.occurred_at)
        ],
    )


@router.post("/{case_id}/decision", response_model=DecisionResponse)
async def record_decision(
    case_id: uuid.UUID, body: DecisionRequest, db: DBSession,
    current_user: CurrentUser, _: Annotated[None, AdjusterPlus],
):
    case = await cases_crud.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if case.status in ("approved", "declined", "closed"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"Case already {case.status}")
    await cases_crud.record_decision(db, case, body.decision, body.rationale, current_user)
    return DecisionResponse(case_id=case_id, decision=body.decision,
                            status=case.status, decided_by=current_user.username)


# ── Document Upload ───────────────────────────────────────────────────────────

@router.post(
    "/{case_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document to a case",
)
async def upload_document(
    case_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
    _: Annotated[None, AdjusterPlus],
    file: UploadFile = File(...),
    doc_type: str = Form(...),
):
    from app.cases.storage import (
        ALLOWED_DOC_TYPES, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, upload_document as _upload,
    )
    from app.cases.models import Document, CaseEvent

    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"doc_type must be one of {sorted(ALLOWED_DOC_TYPES)}",
        )

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type '{file.content_type}' is not allowed. Allowed: PDF, images, Word, Excel.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE_BYTES // (1024*1024)} MB",
        )

    case = await cases_crud.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Upload to storage (non-blocking — run in thread pool)
    loop = asyncio.get_event_loop()
    storage_result = await loop.run_in_executor(
        None, _upload,
        file_bytes, case_id, doc_type, file.filename or "upload", file.content_type,
    )

    doc = Document(
        case_id=case_id,
        doc_type=doc_type,
        storage_path=storage_result["storage_path"],
        original_filename=file.filename,
        mime_type=file.content_type,
        file_size_bytes=storage_result["file_size_bytes"],
        checksum=storage_result["checksum"],
        uploaded_at=datetime.now(timezone.utc),
        uploaded_by=current_user.id,
    )
    db.add(doc)

    event = CaseEvent(
        case_id=case_id,
        event_type="doc_uploaded",
        actor=current_user.username,
        actor_id=current_user.id,
        payload={
            "doc_type": doc_type,
            "filename": file.filename,
            "size_bytes": storage_result["file_size_bytes"],
        },
        occurred_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()

    return DocumentUploadResponse(
        id=doc.id,
        doc_type=doc.doc_type,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        uploaded_at=doc.uploaded_at,
        storage_path=storage_result["storage_path"],
    )


@router.get(
    "/{case_id}/documents/{doc_id}/download",
    summary="Get signed download URL for a document",
)
async def get_document_url(
    case_id: uuid.UUID,
    doc_id: uuid.UUID,
    db: DBSession,
    current_user: CurrentUser,
):
    from sqlalchemy import select
    from app.cases.models import Document
    from app.cases.storage import get_signed_url

    doc = (await db.execute(
        select(Document).where(Document.id == doc_id).where(Document.case_id == case_id)
    )).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    url = get_signed_url(doc.storage_path)
    if url:
        return {"download_url": url, "expires_in_seconds": 900}

    # MinIO not available in dev — return metadata only
    return {
        "download_url": None,
        "storage_path": doc.storage_path,
        "note": "MinIO not reachable in this environment",
    }


# ── Evidence Export ───────────────────────────────────────────────────────────

@router.get(
    "/{case_id}/evidence-export",
    summary="Download evidence pack as PDF",
    responses={200: {"content": {"application/pdf": {}}}},
)
async def evidence_export(
    case_id: uuid.UUID,
    current_user: CurrentUser,
):
    """
    Generate and download a PDF evidence pack for the case.
    Contains: case summary, parties, policy, rule results, ML prediction + SHAP, audit trail.
    """
    from app.cases.pdf_export import generate_evidence_pdf

    loop = asyncio.get_event_loop()
    try:
        pdf_bytes = await loop.run_in_executor(None, generate_evidence_pdf, case_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {str(exc)[:200]}",
        )

    from sqlalchemy import select
    # Get claim ref for filename
    from app.core.db import async_engine  # just to avoid another DB lookup overhead
    # Use the case ID prefix as filename
    filename = f"claimguard_evidence_{str(case_id)[:8]}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Similar Cases ─────────────────────────────────────────────────────────────

@router.get("/{case_id}/similar", response_model=List[SimilarCaseOut])
async def get_similar_cases(case_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    case = await cases_crud.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    similar = await cases_crud.get_similar_cases(db, case)
    return [SimilarCaseOut(id=c.id, external_claim_id=c.external_claim_id, claim_type=c.claim_type,
                           amount_claimed=c.amount_claimed, status=c.status, submitted_at=c.submitted_at,
                           match_reason=reason) for c, reason in similar]


# ── Audit Trail ───────────────────────────────────────────────────────────────

@router.get("/{case_id}/audit", response_model=List[CaseEventOut])
async def get_case_audit(case_id: uuid.UUID, db: DBSession, current_user: CurrentUser):
    case = await cases_crud.get_case_by_id(db, case_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return [CaseEventOut(id=e.id, event_type=e.event_type, actor=e.actor,
                         payload=e.payload, occurred_at=e.occurred_at)
            for e in sorted(case.events, key=lambda x: x.occurred_at)]
