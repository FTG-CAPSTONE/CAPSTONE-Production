from __future__ import annotations

"""
Object storage helpers — MinIO / S3-compatible.

In development (no MinIO running) operations are skipped gracefully:
  - Upload: stores metadata in DB, artifact_path = "local://dev/..."
  - Signed URL: returns a placeholder path
"""

import hashlib
import io
import uuid
from typing import Optional

import structlog

from app.core.config import settings

logger = structlog.get_logger()


def _get_s3_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=settings.OBJECT_STORAGE_ENDPOINT,
        aws_access_key_id=settings.OBJECT_STORAGE_ACCESS_KEY,
        aws_secret_access_key=settings.OBJECT_STORAGE_SECRET_KEY,
        region_name="us-east-1",  # MinIO ignores this; required by boto3
    )


def _ensure_bucket() -> None:
    s3 = _get_s3_client()
    bucket = settings.OBJECT_STORAGE_BUCKET
    try:
        s3.head_bucket(Bucket=bucket)
    except Exception:
        s3.create_bucket(Bucket=bucket)
        logger.info("storage.bucket_created", bucket=bucket)


def upload_document(
    file_bytes: bytes,
    case_id: uuid.UUID,
    doc_type: str,
    original_filename: str,
    mime_type: str,
) -> dict:
    """
    Upload document bytes to MinIO.

    Returns a dict with:
      - storage_path: str (e.g. "documents/{case_id}/{doc_type}_{uuid}.pdf")
      - checksum: str (SHA-256 hex)
      - file_size_bytes: int
    """
    checksum = hashlib.sha256(file_bytes).hexdigest()
    ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
    object_key = f"documents/{case_id}/{doc_type}_{uuid.uuid4().hex}.{ext}"

    try:
        _ensure_bucket()
        s3 = _get_s3_client()
        s3.upload_fileobj(
            io.BytesIO(file_bytes),
            settings.OBJECT_STORAGE_BUCKET,
            object_key,
            ExtraArgs={"ContentType": mime_type},
        )
        storage_path = object_key
        logger.info("storage.uploaded", object_key=object_key, size=len(file_bytes))
    except Exception as exc:
        # Dev fallback: MinIO not running
        logger.warning("storage.upload_skipped", reason=str(exc), key=object_key)
        storage_path = f"local://dev/{object_key}"

    return {
        "storage_path": storage_path,
        "checksum": checksum,
        "file_size_bytes": len(file_bytes),
    }


def get_signed_url(storage_path: str, expires_seconds: int = 900) -> Optional[str]:
    """
    Generate a pre-signed download URL for a stored document.
    Returns None if MinIO is unavailable (dev fallback).
    """
    if storage_path.startswith("local://"):
        return None

    try:
        s3 = _get_s3_client()
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.OBJECT_STORAGE_BUCKET, "Key": storage_path},
            ExpiresIn=expires_seconds,
        )
        return url
    except Exception as exc:
        logger.warning("storage.presign_failed", path=storage_path, error=str(exc))
        return None


# ── MIME type validation ───────────────────────────────────────────────────────

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

ALLOWED_DOC_TYPES = {
    "police_abstract", "repair_quotation", "valuers_report", "logbook",
    "driving_licence", "medical_report", "id_copy", "hospital_discharge",
    "third_party_statement", "insurance_certificate", "other",
}
