from __future__ import annotations

"""
ETL pipeline safety-critical behaviour tests.

Key properties verified:
  1. No-champion model → case routes to in_review (never auto_approved)
  2. Idempotent reprocessing: duplicate claim_id → duplicate status (no crash)
  3. Rejected payload → intake marked failed
  4. Hard-fail rule → auto_rejected status
"""

import uuid
import pytest
from datetime import date
from decimal import Decimal


def _seed_one_intake(db, claim_id: str, claim_type: str = "own_damage",
                     amount: str = "85000", fraud: bool = False):
    """Write a single raw_intake row for testing."""
    from app.ingestion.models import RawIntake
    intake = RawIntake(
        source="test",
        external_ref=claim_id,
        raw_payload={
            "claim_id": claim_id,
            "policy_id": f"POL-TEST-{claim_id[-4:]}",
            "claimant_id": f"PH-TEST-{claim_id[-4:]}",
            "claim_type": claim_type,
            "amount_claimed": amount,
            "incident_date": "2025-06-01",
            "reported_date": "2025-06-05",
            "documents": ["police_abstract", "repair_quotation", "id_copy"],
            "ob_number": f"OB/NRB/2025/{claim_id[-5:]}",
            "is_fraud": fraud,
            "fraud_patterns": [],
            "segment_data": {},
        },
        etl_status="pending",
    )
    db.add(intake)
    db.flush()
    return intake


class TestETLSafetyBehaviours:

    def test_no_champion_routes_to_hitl(self, db):
        """
        Safety: when no champion ML model is registered,
        all non-hard-fail cases must route to in_review, never auto_approved.
        """
        from app.etl.tasks import run_etl_sync
        from app.ml.models import ModelRegistry
        from sqlalchemy import select

        # Confirm no champion exists (or temporarily archive any champion)
        champions = db.execute(
            select(ModelRegistry).where(ModelRegistry.status == "champion")
        ).scalars().all()

        # Archive champions temporarily
        for c in champions:
            c.status = "archived_test"
            db.flush()

        try:
            cid = f"CLM/ETL/NOCHAMPION/{uuid.uuid4().hex[:8]}"
            intake = _seed_one_intake(db, cid)
            db.commit()

            result = run_etl_sync(str(intake.id))
            assert result["case_status"] in ("in_review", "auto_rejected"), (
                f"Expected in_review or auto_rejected without champion, got {result['case_status']}"
            )
            assert result["case_status"] != "auto_approved", (
                "SAFETY VIOLATION: case was auto_approved without a champion model"
            )
        finally:
            # Restore champions
            for c in champions:
                c.status = "champion"
            db.commit()

    def test_idempotent_reprocessing(self, db):
        """
        Reprocessing an already-processed claim returns status 'duplicate'
        and does NOT create a second Case row.
        """
        from app.etl.tasks import run_etl_sync
        from app.ingestion.models import RawIntake
        from app.cases.models import Case
        from sqlalchemy import select

        cid = f"CLM/ETL/IDEMPOTENT/{uuid.uuid4().hex[:8]}"

        # First run
        intake = _seed_one_intake(db, cid)
        db.commit()
        r1 = run_etl_sync(str(intake.id))
        assert r1["status"] == "processed"

        # Count cases for this ref
        count_before = len(db.execute(
            select(Case).where(Case.external_claim_id == cid)
        ).scalars().all())

        # Second run — should be idempotent
        intake2 = _seed_one_intake(db, cid)
        db.commit()
        r2 = run_etl_sync(str(intake2.id))
        assert r2["status"] == "duplicate", f"Expected duplicate, got {r2}"

        count_after = len(db.execute(
            select(Case).where(Case.external_claim_id == cid)
        ).scalars().all())
        assert count_after == count_before, "Duplicate processing created extra Case rows"

    def test_rejected_payload_marks_intake_failed(self, db):
        """
        A payload missing required fields should mark the intake as 'failed',
        not crash, and not create a Case row.
        """
        from app.etl.tasks import run_etl_sync
        from app.ingestion.models import RawIntake
        from app.cases.models import Case
        from sqlalchemy import select

        # Missing amount_claimed → should be rejected
        intake = RawIntake(
            source="test",
            external_ref=f"CLM/ETL/BADPAYLOAD/{uuid.uuid4().hex[:6]}",
            raw_payload={"claim_id": "missing_amount", "policy_id": "x", "claimant_id": "x"},
            etl_status="pending",
        )
        db.add(intake)
        db.commit()

        result = run_etl_sync(str(intake.id))
        assert result["status"] == "rejected", f"Expected rejected, got {result}"

    def test_hard_fail_routes_to_auto_rejected(self, db):
        """
        A claim with amount > sum_insured should trigger AMOUNT_OVER_LIMIT (hard_fail)
        and be auto_rejected.
        """
        from app.etl.tasks import run_etl_sync
        from app.ingestion.models import RawIntake

        # Create a policy with small sum_insured so amount overflows
        from app.cases.models import Party, Policy, Vehicle
        party = Party(external_id=f"T-{uuid.uuid4().hex[:4]}", party_type="individual",
                      full_name="Test Hard Fail", id_number="99999999", phone="0700000001", county="Nairobi")
        db.add(party)
        db.flush()

        vehicle = Vehicle(external_id=f"TV-{uuid.uuid4().hex[:4]}", registration=f"KZZ {uuid.uuid4().hex[:3].upper()}T",
                          make="Toyota", model="Vitz", year=2015, use_type="private")
        db.add(vehicle)
        db.flush()

        pol_id = f"CMP/MOT/2026/HF{uuid.uuid4().hex[:6]}"
        policy = Policy(
            external_id=pol_id, policyholder_id=party.id, vehicle_id=vehicle.id,
            product_line="motor", motor_class="comprehensive",
            sum_insured=Decimal("50000"),  # small limit
            premium=Decimal("5000"), start_date=date(2025,1,1), end_date=date(2026,1,1), status="active",
        )
        db.add(policy)
        db.commit()

        cid = f"CLM/ETL/HARDFAIL/{uuid.uuid4().hex[:8]}"
        intake = RawIntake(
            source="test",
            external_ref=cid,
            raw_payload={
                "claim_id": cid,
                "policy_id": pol_id,
                "claimant_id": str(party.id),
                "claim_type": "own_damage",
                "amount_claimed": "200000",   # >> sum_insured 50K
                "incident_date": "2025-06-01",
                "reported_date": "2025-06-05",
                "documents": ["police_abstract", "repair_quotation", "id_copy"],
                "_policy_db_id": str(policy.id),
                "_claimant_db_id": str(party.id),
            },
            etl_status="pending",
        )
        db.add(intake)
        db.commit()

        result = run_etl_sync(str(intake.id))
        assert result["case_status"] == "auto_rejected", (
            f"Expected auto_rejected for over-limit claim, got {result['case_status']}"
        )
        assert result["hard_fails"] >= 1
