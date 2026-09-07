from __future__ import annotations

import random
import string
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable

from faker import Faker

from app.integration.insuremaster_adapter import InsureMasterAdapter
from app.integration.schemas import (
    AgentRecord,
    ClaimRecord,
    PartyRecord,
    PolicyRecord,
    VehicleRecord,
)

fake = Faker()
fake.seed_instance(42)

# ── Kenya-realistic reference data ────────────────────────────────────────────

COUNTIES = [
    "Nairobi", "Mombasa", "Kiambu", "Nakuru", "Kakamega",
    "Bungoma", "Machakos", "Kisumu", "Meru", "Kilifi",
    "Uasin Gishu", "Nyeri", "Meru", "Embu", "Laikipia",
]
COUNTY_WEIGHTS = [22, 6, 7, 6, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2]

FIRST_NAMES = [
    "James", "John", "Peter", "David", "Samuel", "Michael", "Patrick",
    "George", "Robert", "Anthony", "Francis", "Omar", "Hassan",
    "Waweru", "Kamau", "Njoroge", "Mwangi", "Kariuki",
    "Omondi", "Otieno", "Odhiambo", "Onyango",
    "Kipchoge", "Rotich", "Koech", "Mary", "Grace", "Faith",
    "Joyce", "Caroline", "Ann", "Lucy", "Sarah", "Fatuma",
    "Wanjiku", "Njeri", "Akinyi", "Awino",
]
SURNAMES = [
    "Mwangi", "Kamau", "Odhiambo", "Otieno", "Njoroge", "Kariuki",
    "Hassan", "Omar", "Abdullahi", "Koech", "Ruto", "Kipchoge",
    "Mutua", "Ndungu", "Waweru", "Gitonga", "Ngugi", "Kimani",
    "Ouma", "Achieng", "Owino", "Odero", "Onyango",
    "Rotich", "Bett", "Mutai", "Kiplangat", "Cherono",
]

VEHICLE_MAKES = ["Toyota", "Nissan", "Isuzu", "Mazda", "Mitsubishi", "Subaru", "Honda"]
TOYOTA_MODELS = ["Vitz", "Fielder", "Probox", "Premio", "Axio", "Hiace", "RAV4"]
NISSAN_MODELS = ["Note", "Tiida", "X-Trail", "Navara", "Sunny"]
OTHER_MODELS  = ["Demio", "Outlander", "Forester", "Fit", "D-MAX"]

REPAIRER_NAMES = [
    "Fast Fix Garage", "City Motors", "Highway Autos", "Elite Panels",
    "Nairobi Auto Centre", "Coast Repairers", "Premier Body Works",
    "Rift Valley Motors", "Westlands Garage", "Industrial Area Autos",
    "Thika Road Motors", "Langata Auto Clinic", "CBD Panel Beaters",
    "Mombasa Road Motors", "Eastlands Auto", "Parklands Garage",
]

BRANCHES = [
    ("NBR001", "Nairobi CBD"),   ("NBR002", "Westlands"),
    ("MSA001", "Mombasa"),       ("NKR001", "Nakuru"),
    ("KSM001", "Kisumu"),        ("ELD001", "Eldoret"),
    ("THK001", "Thika"),         ("NYR001", "Nyeri"),
]

CLAIM_TYPES = ["own_damage", "third_party", "theft", "medical", "windscreen"]
CLAIM_WEIGHTS = [45, 20, 12, 8, 15]

DOCUMENT_SETS = {
    "own_damage":  ["police_abstract", "repair_quotation", "id_copy", "valuers_report"],
    "third_party": ["police_abstract", "id_copy", "third_party_statement", "valuers_report"],
    "theft":       ["police_abstract", "logbook", "id_copy", "valuers_report"],
    "medical":     ["medical_report", "id_copy", "police_abstract"],
    "windscreen":  ["repair_quotation"],
}


def _ke_registration() -> str:
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    series = f"K{random.choice(letters)}{random.choice(letters)}"
    return f"{series} {random.randint(100, 999)}{random.choice(letters)}"


def _national_id() -> str:
    return str(random.randint(10_000_000, 39_999_999))


def _kra_pin() -> str:
    return f"A{random.randint(100_000_000, 999_999_999)}{random.choice(string.ascii_uppercase)}"


def _ke_phone() -> str:
    prefix = random.choice(["0700", "0711", "0722", "0733", "0740", "0757"])
    return f"{prefix}{random.randint(100_000, 999_999)}"


def _kenyan_name() -> str:
    return f"{random.choice(FIRST_NAMES)} {random.choice(SURNAMES)}"


def _county() -> str:
    return random.choices(COUNTIES, weights=COUNTY_WEIGHTS)[0]


def _make_model() -> tuple[str, str]:
    make = random.choices(
        VEHICLE_MAKES,
        weights=[45, 15, 8, 7, 6, 5, 4]
    )[0]
    if make == "Toyota":
        model = random.choice(TOYOTA_MODELS)
    elif make == "Nissan":
        model = random.choice(NISSAN_MODELS)
    else:
        model = random.choice(OTHER_MODELS)
    return make, model


def _sum_insured(motor_class: str, year: int) -> Decimal:
    age = date.today().year - year
    base = max(150_000, 1_500_000 - age * 80_000)
    if motor_class == "third_party":
        return Decimal("3000000.00")
    jitter = random.uniform(0.85, 1.15)
    return Decimal(str(round(base * jitter, -3)))


# ── Faker adapter implementation ──────────────────────────────────────────────

class InsureMasterFakerAdapter(InsureMasterAdapter):
    """
    Faker-backed InsureMaster adapter for dev/demo use.
    Generates structurally realistic Kenyan bancassurance data.
    All data is synthetic — no real policyholders or claims.
    """

    async def get_policy(self, policy_id: str) -> PolicyRecord:
        rng = random.Random(hash(policy_id))
        motor_class = rng.choice(["comprehensive", "tpft", "third_party"])
        year = rng.randint(2005, 2022)
        start = date.today() - timedelta(days=rng.randint(10, 1095))
        return PolicyRecord(
            policy_id=policy_id,
            policyholder_id=f"PH-{policy_id[-6:]}",
            vehicle_id=f"VEH-{policy_id[-6:]}",
            product_line="motor",
            motor_class=motor_class,
            sum_insured=_sum_insured(motor_class, year),
            premium=Decimal(str(round(rng.uniform(15_000, 80_000), -2))),
            start_date=start,
            end_date=start + timedelta(days=365),
            status="active",
            agent_code=rng.choice([b[0] for b in BRANCHES]),
            branch_code=rng.choice([b[0] for b in BRANCHES]),
        )

    async def get_party(self, party_id: str) -> PartyRecord:
        rng = random.Random(hash(party_id))
        return PartyRecord(
            party_id=party_id,
            party_type="individual",
            full_name=_kenyan_name(),
            id_number=_national_id(),
            kra_pin=_kra_pin() if rng.random() > 0.3 else None,
            phone=_ke_phone(),
            email=f"{party_id.lower().replace('-', '')}@example.co.ke" if rng.random() > 0.4 else None,
            county=_county(),
        )

    async def get_vehicle(self, vehicle_id: str) -> VehicleRecord:
        rng = random.Random(hash(vehicle_id))
        make, model = _make_model()
        use_type = rng.choices(["private", "commercial", "psv"], weights=[65, 25, 10])[0]
        return VehicleRecord(
            vehicle_id=vehicle_id,
            registration=_ke_registration(),
            make=make,
            model=model,
            year=rng.randint(2005, 2022),
            chassis_number=f"{''.join(rng.choices(string.ascii_uppercase + string.digits, k=17))}",
            engine_number=f"{''.join(rng.choices(string.ascii_uppercase + string.digits, k=10))}",
            body_type=rng.choice(["Saloon", "Station Wagon", "Pickup", "Van"]),
            color=rng.choice(["White", "Silver", "Black", "Blue", "Red", "Grey"]),
            use_type=use_type,
        )

    async def get_agent(self, agent_code: str) -> AgentRecord:
        branch = next((b for b in BRANCHES if b[0] == agent_code), BRANCHES[0])
        return AgentRecord(
            agent_code=agent_code,
            agent_name=_kenyan_name(),
            branch_code=branch[0],
            branch_name=branch[1],
            county=_county(),
        )

    async def list_new_claims(self, since: str) -> Iterable[ClaimRecord]:
        """
        In faker mode, returns an empty iterable.
        New claims are seeded via the dev/seed endpoint instead.
        """
        return []

    async def get_claim(self, claim_id: str) -> ClaimRecord:
        rng = random.Random(hash(claim_id))
        claim_type = rng.choices(CLAIM_TYPES, weights=CLAIM_WEIGHTS)[0]
        incident = date.today() - timedelta(days=rng.randint(1, 60))
        reported = incident + timedelta(days=rng.randint(0, 10))

        # Amount by claim type
        amount_ranges = {
            "own_damage":  (15_000,  800_000),
            "third_party": (30_000, 2_000_000),
            "theft":       (200_000, 5_000_000),
            "windscreen":  (3_000,   35_000),
            "medical":     (10_000,  500_000),
        }
        lo, hi = amount_ranges[claim_type]
        amount = Decimal(str(round(rng.uniform(lo, hi), -2)))

        # Documents — randomly drop 0–2 from the expected set
        full_docs = DOCUMENT_SETS[claim_type].copy()
        rng.shuffle(full_docs)
        docs_present = full_docs[: max(1, len(full_docs) - rng.randint(0, 2))]

        return ClaimRecord(
            claim_id=claim_id,
            policy_id=f"POL-{claim_id[-6:]}",
            claimant_id=f"PH-{claim_id[-6:]}",
            claim_type=claim_type,
            amount_claimed=amount,
            incident_date=incident,
            reported_date=reported,
            documents=docs_present,
            ob_number=f"OB/NRB/{date.today().year}/{rng.randint(10000, 99999)}"
            if claim_type not in ("windscreen", "medical")
            else None,
            provider_id=f"REP-{rng.randint(1, len(REPAIRER_NAMES)):03d}",
            provider_name=REPAIRER_NAMES[(rng.randint(1, len(REPAIRER_NAMES)) - 1)],
            segment_data={
                "is_fraud": False,
                "fraud_patterns": [],
                "fraud_label_source": "faker_clean",
            },
        )

    async def get_policyholder_claim_history(
        self, party_id: str
    ) -> Iterable[ClaimRecord]:
        """
        Returns 0–3 synthetic prior claims for enrichment purposes.
        Prior claim IDs are deterministic from party_id seed.
        """
        rng = random.Random(hash(f"history_{party_id}"))
        n_prior = rng.choices([0, 1, 2, 3], weights=[65, 25, 8, 2])[0]
        claims = []
        for i in range(n_prior):
            prior_id = f"CLM-PRIOR-{party_id[-4:]}-{i}"
            claims.append(await self.get_claim(prior_id))
        return claims

    async def get_provider_claim_history(
        self, provider_id: str
    ) -> Iterable[ClaimRecord]:
        """
        Returns 2–20 synthetic prior claims for this repairer.
        Pareto-shaped — top providers (REP-001..005) get more volume.
        """
        rng = random.Random(hash(f"provider_{provider_id}"))
        # Top 5 repairers have higher volume
        rep_num = int(provider_id.split("-")[-1]) if "-" in provider_id else 10
        if rep_num <= 5:
            n = rng.randint(12, 25)
        else:
            n = rng.randint(2, 8)

        claims = []
        for i in range(n):
            cid = f"CLM-PROV-{provider_id[-3:]}-{i}"
            claims.append(await self.get_claim(cid))
        return claims
