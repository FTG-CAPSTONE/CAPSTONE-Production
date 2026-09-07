"""
ClaimGuard synthetic data seed CLI.

Usage:
    python -m synth.seed_cli [OPTIONS]

Options:
    --policyholders INT   Number of policyholders  [default: 200]
    --repairers     INT   Number of repairers       [default: 20]
    --fraud-rate    FLOAT Fraction of fraud claims  [default: 0.10]
    --seed          INT   Random seed               [default: 42]
    --dry-run             Generate but do not write to DB
    --verbose             Print progress

Examples:
    python -m synth.seed_cli --policyholders 500 --seed 42
    python -m synth.seed_cli --policyholders 100 --dry-run --verbose
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone

from synth.generators import (
    generate_claims,
    generate_policyholders,
    generate_policies,
    generate_repairers,
    generate_vehicles,
)
from synth.fraud_injector import inject_fraud_patterns


def run(
    n_policyholders: int = 200,
    n_repairers: int = 20,
    fraud_rate: float = 0.10,
    seed: int = 42,
    dry_run: bool = False,
    verbose: bool = False,
) -> dict:
    def log(msg: str) -> None:
        if verbose:
            print(msg)

    log(f"[synth] seed={seed}  policyholders={n_policyholders}  fraud_rate={fraud_rate}")

    policyholders = generate_policyholders(n_policyholders, rng_seed=seed)
    log(f"[synth] generated {len(policyholders)} policyholders")

    vehicles = generate_vehicles(policyholders, rng_seed=seed)
    log(f"[synth] generated {len(vehicles)} vehicles")

    repairers = generate_repairers(n_repairers)
    log(f"[synth] generated {len(repairers)} repairers")

    policies = generate_policies(policyholders, vehicles, rng_seed=seed)
    log(f"[synth] generated {len(policies)} policies")

    claims_raw = generate_claims(policies, repairers, fraud_rate=0.0, rng_seed=seed)
    claims = inject_fraud_patterns(claims_raw, fraud_rate=fraud_rate, rng_seed=seed)
    n_fraud = sum(1 for c in claims if c.is_fraud)
    log(f"[synth] generated {len(claims)} claims ({n_fraud} fraud, {len(claims)-n_fraud} clean)")

    stats = {
        "policyholders": len(policyholders),
        "vehicles": len(vehicles),
        "repairers": len(repairers),
        "policies": len(policies),
        "claims": len(claims),
        "fraud_injected": n_fraud,
        "seed_used": seed,
    }

    if dry_run:
        log("[synth] dry-run — not writing to database")
        return stats

    # Write to database
    from app.core.config import settings
    from app.core.db import SyncSessionLocal
    from app.cases.models import Case, CaseEvent, Party, Policy, Vehicle
    from app.ingestion.models import IngestLog, RawIntake

    import uuid
    from datetime import datetime, timezone
    from decimal import Decimal

    session = SyncSessionLocal()
    batch_id = f"seed-{seed}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    try:
        # Write parties (policyholders + repairers)
        party_map: dict[str, uuid.UUID] = {}

        all_parties = policyholders + repairers
        for p in all_parties:
            db_party = Party(
                external_id=p.party_id,
                party_type=p.party_type,
                full_name=p.full_name,
                id_number=p.id_number,
                kra_pin=p.kra_pin,
                phone=p.phone,
                email=p.email,
                county=p.county,
            )
            session.add(db_party)
            session.flush()
            party_map[p.party_id] = db_party.id

        # Write vehicles
        vehicle_map: dict[str, uuid.UUID] = {}
        for v in vehicles:
            db_vehicle = Vehicle(
                external_id=v.vehicle_id,
                party_id=party_map.get(v.owner_party_id),
                registration=v.registration,
                make=v.make,
                model=v.model,
                year=v.year,
                chassis_number=v.chassis_number,
                engine_number=v.engine_number,
                body_type=v.body_type,
                color=v.color,
                use_type=v.use_type,
            )
            session.add(db_vehicle)
            session.flush()
            vehicle_map[v.vehicle_id] = db_vehicle.id

        # Write policies
        policy_map: dict[str, uuid.UUID] = {}
        for pol in policies:
            # Skip if this policy number already exists (cross-seed collision guard)
            from sqlalchemy import select
            existing_pol = session.execute(
                select(Policy).where(Policy.external_id == pol.policy_id)
            ).scalar_one_or_none()
            if existing_pol:
                policy_map[pol.policy_id] = existing_pol.id
                continue

            db_policy = Policy(
                external_id=pol.policy_id,
                policyholder_id=party_map.get(pol.policyholder_id),
                vehicle_id=vehicle_map.get(pol.vehicle_id),
                product_line=pol.product_line,
                motor_class=pol.motor_class,
                sum_insured=pol.sum_insured,
                premium=pol.premium,
                start_date=pol.start_date,
                end_date=pol.end_date,
                agent_code=pol.agent_code,
                branch_code=pol.branch_code,
                status=pol.status,
            )
            session.add(db_policy)
            session.flush()
            policy_map[pol.policy_id] = db_policy.id

        # Write raw_intake rows for each claim (ETL will process them)
        log_row = IngestLog(
            batch_id=batch_id,
            source="dev_seed",
            row_count=len(claims),
        )
        session.add(log_row)
        session.flush()

        for claim in claims:
            # Skip if this claim reference already exists
            from sqlalchemy import select as sa_select
            existing_intake = session.execute(
                sa_select(RawIntake).where(RawIntake.external_ref == claim.claim_id)
            ).scalar_one_or_none()
            if existing_intake:
                continue

            intake = RawIntake(
                source="dev_seed",
                external_ref=claim.claim_id,
                raw_payload={
                    "claim_id": claim.claim_id,
                    "policy_id": claim.policy_id,
                    "claimant_id": claim.claimant_id,
                    "claim_type": claim.claim_type,
                    "amount_claimed": str(claim.amount_claimed),
                    "incident_date": claim.incident_date.isoformat(),
                    "reported_date": claim.reported_date.isoformat(),
                    "documents": claim.documents,
                    "ob_number": claim.ob_number,
                    "provider_id": claim.provider_id,
                    "provider_name": claim.provider_name,
                    "county": claim.county,
                    "is_fraud": claim.is_fraud,
                    "fraud_patterns": claim.fraud_patterns,
                    "segment_data": claim.segment_data,
                    # Resolved internal IDs for ETL convenience
                    "_policy_db_id": str(policy_map.get(claim.policy_id, "")),
                    "_claimant_db_id": str(party_map.get(claim.claimant_id, "")),
                    "_provider_db_id": str(party_map.get(claim.provider_id, "")),
                },
                etl_status="pending",
            )
            session.add(intake)

        session.commit()
        log(f"[synth] committed batch {batch_id} to database")
        stats["batch_id"] = batch_id

    except Exception as exc:
        session.rollback()
        raise exc
    finally:
        session.close()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="ClaimGuard synthetic data seed")
    parser.add_argument("--policyholders", type=int, default=200)
    parser.add_argument("--repairers", type=int, default=20)
    parser.add_argument("--fraud-rate", type=float, default=0.10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    stats = run(
        n_policyholders=args.policyholders,
        n_repairers=args.repairers,
        fraud_rate=args.fraud_rate,
        seed=args.seed,
        dry_run=args.dry_run,
        verbose=True,  # always verbose from CLI
    )
    print("\n=== Seed Summary ===")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
