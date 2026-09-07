from __future__ import annotations

"""Shared pytest fixtures for ClaimGuard backend tests."""

import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# ── Set test env BEFORE any app imports ──────────────────────────────────────
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg2://claimguard:cg_secure_2026@127.0.0.1:5432/claimguard",
)
os.environ.setdefault(
    "ASYNC_DATABASE_URL",
    "postgresql+asyncpg://claimguard:cg_secure_2026@127.0.0.1:5432/claimguard",
)

import app.users.models   # noqa: F401  — register all FK targets
import app.cases.models   # noqa: F401
import app.ingestion.models # noqa: F401
import app.rules.models   # noqa: F401
import app.ml.models      # noqa: F401
import app.hitl.models    # noqa: F401
import app.quality.models # noqa: F401

from app.core.db import Base, SyncSessionLocal, sync_engine
from app.core.security import hash_password


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Ensure all tables exist for the test session (uses same DB as dev)."""
    Base.metadata.create_all(bind=sync_engine)
    yield
    # Do NOT drop tables — tests share the dev DB and we want data to persist


@pytest.fixture
def db() -> Session:
    """Provide a sync DB session, rolling back after each test."""
    session = SyncSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def admin_user(db: Session):
    """Create (or retrieve) an admin user for testing."""
    from app.users.models import AppRole, AppUser
    from sqlalchemy import select

    role = db.execute(select(AppRole).where(AppRole.name == "admin")).scalar_one_or_none()
    if not role:
        role = AppRole(name="admin", description="Test admin")
        db.add(role)
        db.flush()

    user = db.execute(
        select(AppUser).where(AppUser.username == "test_admin")
    ).scalar_one_or_none()

    if not user:
        user = AppUser(
            username="test_admin",
            full_name="Test Admin",
            hashed_password=hash_password("test_password_123"),
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.flush()

    return user


@pytest.fixture
def sample_case(db: Session):
    """Create a minimal Case for testing."""
    from app.cases.models import Case, Party, Policy, Vehicle
    from sqlalchemy import select

    # Party
    party = Party(
        external_id=f"TEST-PH-{uuid.uuid4().hex[:6]}",
        party_type="individual",
        full_name="Test Claimant",
        id_number="12345678",
        phone="0700000000",
        county="Nairobi",
    )
    db.add(party)
    db.flush()

    # Vehicle + Policy
    vehicle = Vehicle(
        external_id=f"TEST-VEH-{uuid.uuid4().hex[:6]}",
        registration=f"KCA {uuid.uuid4().hex[:3].upper()}T",  # unique per run
        make="Toyota",
        model="Vitz",
        year=2015,
        use_type="private",
    )
    db.add(vehicle)
    db.flush()

    policy = Policy(
        external_id=f"CMP/MOT/2026/{uuid.uuid4().hex[:6]}",
        policyholder_id=party.id,
        vehicle_id=vehicle.id,
        product_line="motor",
        motor_class="comprehensive",
        sum_insured=Decimal("800000"),
        premium=Decimal("45000"),
        start_date=date(2025, 1, 1),
        end_date=date(2026, 1, 1),
        status="active",
    )
    db.add(policy)
    db.flush()

    case = Case(
        case_type="claim",
        line_of_business="motor",
        claim_type="own_damage",
        external_claim_id=f"CLM/TEST/{uuid.uuid4().hex[:8]}",
        policy_id=policy.id,
        claimant_id=party.id,
        amount_claimed=Decimal("150000"),
        currency="KES",
        incident_date=date(2025, 6, 1),
        reported_date=date(2025, 6, 5),
        status="in_review",
        segment_data={
            "is_fraud": False,
            "documents": ["police_abstract", "repair_quotation", "id_copy"],
            "ob_number": f"OB/NRB/2025/{uuid.uuid4().hex[:5]}",
        },
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(case)
    db.flush()
    db.commit()   # commit so the PDF generator (new session) can see this case
    return case
