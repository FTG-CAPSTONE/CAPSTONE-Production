from __future__ import annotations

"""
InsureMaster adapter contract tests.

These tests verify that the adapter interface is correctly implemented.
They run against the Faker adapter today and MUST also pass against
the live adapter when INSUREMASTER_MODE=live.

Run with:
  pytest tests/test_adapter_contract.py -v
  INSUREMASTER_MODE=live pytest tests/test_adapter_contract.py -v  (future)
"""

import asyncio
import pytest
from decimal import Decimal
from datetime import date


def _adapter():
    from app.integration.insuremaster_adapter import get_adapter
    return get_adapter()


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


class TestAdapterContract:
    """All adapter implementations must satisfy these contracts."""

    adapter = None

    @pytest.fixture(autouse=True)
    def setup(self):
        self.adapter = _adapter()

    def test_get_policy_returns_valid_record(self):
        p = run(self.adapter.get_policy("POL-000001"))
        assert p.policy_id is not None
        assert isinstance(p.sum_insured, Decimal)
        assert p.sum_insured > 0
        assert p.start_date < p.end_date
        assert p.product_line in ("motor", "health", "marine_cargo", "general")

    def test_get_party_returns_valid_record(self):
        p = run(self.adapter.get_party("PH-000001"))
        assert p.party_id is not None
        assert isinstance(p.full_name, str)
        assert len(p.full_name) > 2
        assert p.party_type in ("individual", "corporate", "provider")

    def test_get_vehicle_returns_valid_record(self):
        v = run(self.adapter.get_vehicle("VEH-000001"))
        assert v.vehicle_id is not None
        assert isinstance(v.registration, str)
        assert isinstance(v.year, int)
        assert 2000 <= v.year <= 2030
        assert v.use_type in ("private", "psv", "commercial")

    def test_get_claim_returns_valid_record(self):
        c = run(self.adapter.get_claim("CLM-TEST-001"))
        assert c.claim_id is not None
        assert isinstance(c.amount_claimed, Decimal)
        assert c.amount_claimed > 0
        assert isinstance(c.incident_date, date)
        assert isinstance(c.reported_date, date)
        assert c.claim_type in (
            "own_damage", "third_party", "theft", "windscreen", "medical"
        )

    def test_claim_dates_are_consistent(self):
        c = run(self.adapter.get_claim("CLM-TEST-002"))
        # reported_date should not be before incident_date by more than 1 day
        # (1 day tolerance for Faker rounding)
        assert (c.reported_date - c.incident_date).days >= -1

    def test_list_new_claims_returns_iterable(self):
        claims = list(run(self.adapter.list_new_claims("2026-01-01T00:00:00Z")))
        # Empty is valid for Faker adapter (no polling)
        assert isinstance(claims, list)

    def test_get_policyholder_claim_history_type(self):
        history = list(run(self.adapter.get_policyholder_claim_history("PH-000001")))
        assert isinstance(history, list)
        # All items must be ClaimRecord
        from app.integration.schemas import ClaimRecord
        for item in history:
            assert isinstance(item, ClaimRecord)

    def test_get_provider_claim_history_type(self):
        history = list(run(self.adapter.get_provider_claim_history("REP-001")))
        assert isinstance(history, list)
        from app.integration.schemas import ClaimRecord
        for item in history:
            assert isinstance(item, ClaimRecord)
