from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.ingestion.models import IngestLog, RawIntake


async def create_raw_intake(db: AsyncSession, source: str, external_ref: str, raw_payload: dict) -> RawIntake:
    row = RawIntake(source=source, external_ref=external_ref, raw_payload=raw_payload, etl_status="pending")
    db.add(row)
    await db.flush()
    return row


async def get_raw_intake_by_ref(db: AsyncSession, external_ref: str) -> Optional[RawIntake]:
    result = await db.execute(select(RawIntake).where(RawIntake.external_ref == external_ref))
    return result.scalar_one_or_none()


async def get_pending_intakes(db: AsyncSession, limit: int = 100) -> List[RawIntake]:
    result = await db.execute(select(RawIntake).where(RawIntake.etl_status == "pending").limit(limit))
    return list(result.scalars().all())


async def list_raw_intakes(db: AsyncSession, skip: int = 0, limit: int = 50) -> List[RawIntake]:
    result = await db.execute(
        select(RawIntake).order_by(RawIntake.received_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def get_ingest_logs(db: AsyncSession, skip: int = 0, limit: int = 50) -> List[IngestLog]:
    result = await db.execute(
        select(IngestLog).order_by(IngestLog.ingested_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())
