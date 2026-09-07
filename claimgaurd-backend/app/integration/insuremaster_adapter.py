from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterable

from app.integration.schemas import (
    AgentRecord,
    ClaimRecord,
    PartyRecord,
    PolicyRecord,
    VehicleRecord,
)


class InsureMasterAdapter(ABC):
    """
    Everything ClaimGuard needs from InsureMaster — nothing more.

    ClaimGuard is strictly READ-ONLY against InsureMaster in the MVP.
    All scoring, decisions, and audit records are ClaimGuard-owned.

    In dev/demo:    insuremaster_faker.py satisfies this interface.
    In production:  insuremaster_live.py satisfies this interface.

    Switching between them is controlled entirely by INSUREMASTER_MODE env var.
    The contract test (tests/test_adapter_contract.py) must pass for both.
    """

    @abstractmethod
    async def get_policy(self, policy_id: str) -> PolicyRecord:
        """Return a single policy by its InsureMaster policy number."""
        ...

    @abstractmethod
    async def get_party(self, party_id: str) -> PartyRecord:
        """Return a party (policyholder, corporate, or provider) by InsureMaster client number."""
        ...

    @abstractmethod
    async def get_vehicle(self, vehicle_id: str) -> VehicleRecord:
        """Return a vehicle record by registration or internal vehicle ID."""
        ...

    @abstractmethod
    async def get_agent(self, agent_code: str) -> AgentRecord:
        """Return an agent/branch record by agent code."""
        ...

    @abstractmethod
    async def list_new_claims(self, since: str) -> Iterable[ClaimRecord]:
        """
        Return claims submitted or updated since the given ISO timestamp.
        Used by the Celery beat poll task as a fallback to webhook delivery.
        """
        ...

    @abstractmethod
    async def get_claim(self, claim_id: str) -> ClaimRecord:
        """Return a single claim by its InsureMaster claim reference."""
        ...

    @abstractmethod
    async def get_policyholder_claim_history(
        self, party_id: str
    ) -> Iterable[ClaimRecord]:
        """
        Return all historical claims for a policyholder.
        Used in ETL enrichment to compute prior_claims_count and
        prior_claims_total_amount features.
        """
        ...

    @abstractmethod
    async def get_provider_claim_history(
        self, provider_id: str
    ) -> Iterable[ClaimRecord]:
        """
        Return all claims processed through a repairer/provider.
        Used in ETL enrichment to compute provider_claim_count_30d and
        provider_claim_amount_30d features.
        """
        ...


def get_adapter() -> InsureMasterAdapter:
    """
    Factory — returns the correct adapter implementation based on INSUREMASTER_MODE.
    Import this wherever the adapter is needed; never instantiate directly.
    """
    from app.core.config import settings

    if settings.INSUREMASTER_MODE == "live":
        from app.integration.insuremaster_live import InsureMasterLiveAdapter
        return InsureMasterLiveAdapter()

    from app.integration.insuremaster_faker import InsureMasterFakerAdapter
    return InsureMasterFakerAdapter()
