from __future__ import annotations

"""
InsureMaster Live Adapter — STUB

This file is intentionally incomplete. It cannot be implemented until
real InsureMaster API credentials and data dictionary are available.

Implementation guide: see ClaimGuard_InsureMaster_Context_Map.md §4

When implementing:
1. Authenticate as a ClaimGuard service account against AuthenticationService
2. All GET calls go to FinanceService (/api/v1/policies/*, /api/v1/claims/*)
   and CRMService (/api/v1/clients/*)
3. Map InsureMaster camelCase field names to ClaimRecord/PolicyRecord fields
   using FINANCE_SERVICE_CLAIM_FIELD_MAP in the context map document
4. Run tests/test_adapter_contract.py with INSUREMASTER_MODE=live — if it
   passes, the entire ETL/rules/ML pipeline works unchanged

To enable: set INSUREMASTER_MODE=live in .env
"""

from typing import Iterable

import httpx

from app.core.config import settings
from app.integration.insuremaster_adapter import InsureMasterAdapter
from app.integration.schemas import (
    AgentRecord,
    ClaimRecord,
    PartyRecord,
    PolicyRecord,
    VehicleRecord,
)


class InsureMasterLiveAdapter(InsureMasterAdapter):
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            base_url=settings.INSUREMASTER_BASE_URL,
            headers={"X-API-Key": settings.INSUREMASTER_API_KEY},
            timeout=10.0,
        )

    async def get_policy(self, policy_id: str) -> PolicyRecord:
        raise NotImplementedError(
            "InsureMasterLiveAdapter.get_policy not yet implemented. "
            "See ClaimGuard_InsureMaster_Context_Map.md for the implementation guide."
        )

    async def get_party(self, party_id: str) -> PartyRecord:
        raise NotImplementedError("InsureMasterLiveAdapter.get_party not yet implemented.")

    async def get_vehicle(self, vehicle_id: str) -> VehicleRecord:
        raise NotImplementedError("InsureMasterLiveAdapter.get_vehicle not yet implemented.")

    async def get_agent(self, agent_code: str) -> AgentRecord:
        raise NotImplementedError("InsureMasterLiveAdapter.get_agent not yet implemented.")

    async def list_new_claims(self, since: str) -> Iterable[ClaimRecord]:
        raise NotImplementedError("InsureMasterLiveAdapter.list_new_claims not yet implemented.")

    async def get_claim(self, claim_id: str) -> ClaimRecord:
        raise NotImplementedError("InsureMasterLiveAdapter.get_claim not yet implemented.")

    async def get_policyholder_claim_history(self, party_id: str) -> Iterable[ClaimRecord]:
        raise NotImplementedError(
            "InsureMasterLiveAdapter.get_policyholder_claim_history not yet implemented."
        )

    async def get_provider_claim_history(self, provider_id: str) -> Iterable[ClaimRecord]:
        raise NotImplementedError(
            "InsureMasterLiveAdapter.get_provider_claim_history not yet implemented."
        )
