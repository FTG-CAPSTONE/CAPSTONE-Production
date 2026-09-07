from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import List

from faker import Faker

from synth.providers import KenyaInsuranceProvider, KenyaPersonProvider, KenyaVehicleProvider

fake = Faker()
fake.add_provider(KenyaPersonProvider)
fake.add_provider(KenyaVehicleProvider)
fake.add_provider(KenyaInsuranceProvider)


@dataclass
class SynthParty:
    party_id: str
    party_type: str
    full_name: str
    id_number: str
    kra_pin: str | None
    phone: str
    email: str | None
    county: str


@dataclass
class SynthVehicle:
    vehicle_id: str
    owner_party_id: str
    registration: str
    make: str
    model: str
    year: int
    chassis_number: str
    engine_number: str
    body_type: str
    color: str
    use_type: str


@dataclass
class SynthPolicy:
    policy_id: str
    policyholder_id: str
    vehicle_id: str
    product_line: str = "motor"
    motor_class: str = "comprehensive"
    sum_insured: Decimal = field(default_factory=lambda: Decimal("0"))
    premium: Decimal = field(default_factory=lambda: Decimal("0"))
    start_date: date = field(default_factory=date.today)
    end_date: date = field(default_factory=date.today)
    agent_code: str = ""
    branch_code: str = ""
    status: str = "active"


@dataclass
class SynthClaim:
    claim_id: str
    policy_id: str
    claimant_id: str
    claim_type: str
    amount_claimed: Decimal
    incident_date: date
    reported_date: date
    documents: List[str]
    ob_number: str | None
    provider_id: str
    provider_name: str
    county: str
    is_fraud: bool = False
    fraud_patterns: List[str] = field(default_factory=list)
    segment_data: dict = field(default_factory=dict)


REQUIRED_DOCS = {
    "own_damage":  ["police_abstract", "repair_quotation", "id_copy"],
    "third_party": ["police_abstract", "id_copy", "third_party_statement"],
    "theft":       ["police_abstract", "logbook", "id_copy"],
    "medical":     ["medical_report", "id_copy"],
    "windscreen":  ["repair_quotation"],
}
OPTIONAL_DOCS = {
    "own_damage":  ["valuers_report", "driving_licence"],
    "third_party": ["valuers_report"],
    "theft":       ["valuers_report", "insurance_certificate"],
    "medical":     ["police_abstract", "hospital_discharge"],
    "windscreen":  [],
}

CLAIM_TYPES = ["own_damage", "third_party", "theft", "windscreen", "medical"]
CLAIM_WEIGHTS = [45, 20, 12, 15, 8]
MOTOR_CLASSES = ["comprehensive", "tpft", "third_party"]
MOTOR_CLASS_WEIGHTS = [55, 25, 20]


def _sum_insured(motor_class: str, year: int) -> Decimal:
    age = date.today().year - year
    base = max(150_000, 1_500_000 - age * 75_000)
    if motor_class == "third_party":
        return Decimal("3000000.00")
    jitter = random.uniform(0.85, 1.15)
    return Decimal(str(round(base * jitter, -3)))


def _claim_amount(claim_type: str, sum_insured: Decimal) -> Decimal:
    ranges = {
        "own_damage":  (0.05, 0.70),
        "third_party": (0.10, 0.90),
        "theft":       (0.90, 1.05),
        "windscreen":  (0.005, 0.025),
        "medical":     (0.01, 0.35),
    }
    lo, hi = ranges[claim_type]
    raw = float(sum_insured) * random.uniform(lo, hi)
    return Decimal(str(round(raw, -2)))


def _documents(claim_type: str) -> List[str]:
    required = REQUIRED_DOCS[claim_type].copy()
    optional = OPTIONAL_DOCS[claim_type].copy()
    random.shuffle(optional)
    present_optional = [d for d in optional if random.random() > 0.30]
    return required + present_optional


def generate_policyholders(n: int, rng_seed: int | None = None) -> List[SynthParty]:
    if rng_seed is not None:
        fake.seed_instance(rng_seed)
        random.seed(rng_seed)
    parties = []
    for i in range(n):
        pid = f"PH-{i+1:06d}"
        parties.append(SynthParty(
            party_id=pid,
            party_type="individual",
            full_name=fake.kenyan_full_name(),
            id_number=fake.national_id(),
            kra_pin=fake.kra_pin() if random.random() > 0.25 else None,
            phone=fake.ke_phone(),
            email=f"{pid.lower()}@example.co.ke" if random.random() > 0.40 else None,
            county=fake.ke_county(),
        ))
    return parties


def generate_vehicles(
    policyholders: List[SynthParty],
    ratio: float = 1.1,
    rng_seed: int | None = None,
) -> List[SynthVehicle]:
    if rng_seed is not None:
        random.seed(rng_seed + 1)
    vehicles = []
    used_plates: set = set()
    n = max(len(policyholders), int(len(policyholders) * ratio))
    for i in range(n):
        owner = policyholders[i % len(policyholders)]
        make = fake.vehicle_make()
        plate = fake.ke_registration()
        attempts = 0
        while plate in used_plates and attempts < 10:
            plate = fake.ke_registration()
            attempts += 1
        used_plates.add(plate)
        vehicles.append(SynthVehicle(
            vehicle_id=f"VEH-{i+1:06d}",
            owner_party_id=owner.party_id,
            registration=plate,
            make=make,
            model=fake.vehicle_model(make),
            year=fake.vehicle_year(),
            chassis_number=fake.chassis_number(),
            engine_number=fake.engine_number(),
            body_type=random.choices(
                ["Saloon", "Station Wagon", "Pickup", "Van", "Minibus"],
                weights=[40, 30, 15, 10, 5],
            )[0],
            color=random.choices(
                ["White", "Silver", "Black", "Blue", "Red", "Grey"],
                weights=[35, 20, 15, 12, 10, 8],
            )[0],
            use_type=fake.vehicle_use_type(),
        ))
    return vehicles


def generate_repairers(n: int = 20) -> List[SynthParty]:
    repairers = []
    for i in range(n):
        name = fake.repairer_name()
        repairers.append(SynthParty(
            party_id=f"REP-{i+1:03d}",
            party_type="provider",
            full_name=name,
            id_number=fake.national_id(),
            kra_pin=fake.kra_pin(),
            phone=fake.ke_phone(),
            email=f"rep{i+1:03d}@repairs.co.ke",
            county=fake.ke_county(),
        ))
    return repairers


def generate_policies(
    policyholders: List[SynthParty],
    vehicles: List[SynthVehicle],
    rng_seed: int | None = None,
) -> List[SynthPolicy]:
    if rng_seed is not None:
        random.seed(rng_seed + 2)
    year = date.today().year
    policies = []
    for i, vehicle in enumerate(vehicles):
        owner = next(
            (p for p in policyholders if p.party_id == vehicle.owner_party_id),
            policyholders[i % len(policyholders)],
        )
        motor_class = random.choices(MOTOR_CLASSES, weights=MOTOR_CLASS_WEIGHTS)[0]
        sum_insured = _sum_insured(motor_class, vehicle.year)
        premium = Decimal(str(round(float(sum_insured) * random.uniform(0.04, 0.08), -2)))
        days_ago = random.randint(15, 1095)
        start = date.today() - timedelta(days=days_ago)
        end = start + timedelta(days=365)
        branch_code, _ = fake.branch()
        policies.append(SynthPolicy(
            policy_id=fake.policy_number(motor_class, year),
            policyholder_id=owner.party_id,
            vehicle_id=vehicle.vehicle_id,
            motor_class=motor_class,
            sum_insured=sum_insured,
            premium=premium,
            start_date=start,
            end_date=end,
            agent_code=branch_code,
            branch_code=branch_code,
            status="active" if end >= date.today() else "lapsed",
        ))
    return policies


def generate_claims(
    policies: List[SynthPolicy],
    repairers: List[SynthParty],
    fraud_rate: float = 0.10,
    rng_seed: int | None = None,
) -> List[SynthClaim]:
    if rng_seed is not None:
        random.seed(rng_seed + 3)
    year = date.today().year
    claims: List[SynthClaim] = []
    for policy in policies:
        n_claims = random.choices([0, 1, 2, 3], weights=[60, 30, 8, 2])[0]
        for _ in range(n_claims):
            claim_type = random.choices(CLAIM_TYPES, weights=CLAIM_WEIGHTS)[0]
            amount = _claim_amount(claim_type, policy.sum_insured)
            policy_days = (policy.end_date - policy.start_date).days
            incident_offset = random.randint(1, max(1, policy_days - 1))
            incident = policy.start_date + timedelta(days=incident_offset)
            if incident > date.today():
                incident = date.today() - timedelta(days=random.randint(1, 30))
            report_delay = max(0, int(random.expovariate(1 / 3)))
            reported = incident + timedelta(days=min(report_delay, 60))
            docs = _documents(claim_type)
            repairer_idx = int(random.expovariate(0.3)) % len(repairers)
            repairer = repairers[repairer_idx]
            ob = (
                fake.ob_number(policy.policyholder_id[:3], year)
                if claim_type not in ("windscreen",)
                else None
            )
            claims.append(SynthClaim(
                claim_id=fake.claim_reference(year),
                policy_id=policy.policy_id,
                claimant_id=policy.policyholder_id,
                claim_type=claim_type,
                amount_claimed=amount,
                incident_date=incident,
                reported_date=reported,
                documents=docs,
                ob_number=ob,
                provider_id=repairer.party_id,
                provider_name=repairer.full_name,
                county=fake.ke_county(),
            ))
    return claims
