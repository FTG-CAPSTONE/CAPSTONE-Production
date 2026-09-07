from __future__ import annotations

import random
from copy import deepcopy
from datetime import timedelta
from decimal import Decimal
from typing import List

from synth.generators import SynthClaim

ROUND_AMOUNTS = [
    50_000, 75_000, 100_000, 120_000, 150_000,
    200_000, 250_000, 300_000, 350_000, 400_000, 500_000,
]


def inject_fraud_patterns(
    claims: List[SynthClaim],
    fraud_rate: float = 0.10,
    rng_seed: int | None = None,
) -> List[SynthClaim]:
    if rng_seed is not None:
        random.seed(rng_seed + 99)
    result = [deepcopy(c) for c in claims]
    n_fraud = max(1, int(len(result) * fraud_rate))
    candidates = sorted(range(len(result)), key=lambda i: float(result[i].amount_claimed), reverse=True)
    top_pool = candidates[: int(len(candidates) * 0.6)]
    rest_pool = candidates[int(len(candidates) * 0.6):]
    top_n = int(n_fraud * 0.6)
    rest_n = n_fraud - top_n
    selected = (
        random.sample(top_pool, min(top_n, len(top_pool)))
        + random.sample(rest_pool, min(rest_n, len(rest_pool)))
    )
    for idx in selected:
        claim = result[idx]
        n_patterns = 2 if random.random() < 0.25 else 1
        available = list(FRAUD_PATTERNS.keys())
        random.shuffle(available)
        for pattern_name in available[:n_patterns]:
            FRAUD_PATTERNS[pattern_name](claim)
            if pattern_name not in claim.fraud_patterns:
                claim.fraud_patterns.append(pattern_name)
        claim.is_fraud = True
        claim.segment_data["fraud_label_source"] = "synthetic_injector"
    return result


def _quick_claim(claim: SynthClaim) -> None:
    claim.segment_data["forced_days_since_inception"] = random.randint(1, 12)
    claim.segment_data["days_to_report"] = random.randint(0, 2)
    claim.segment_data["inflate_to_limit_fraction"] = random.uniform(0.85, 0.99)


def _duplicate_ob(claim: SynthClaim) -> None:
    claim.segment_data["ob_duplicate"] = True
    claim.segment_data["days_to_report"] = random.randint(0, 1)


def _provider_spike(claim: SynthClaim) -> None:
    claim.segment_data["forced_provider_claim_count_30d"] = random.randint(18, 35)
    claim.segment_data["forced_provider_claim_amount_30d"] = float(
        claim.amount_claimed * Decimal(str(random.randint(18, 35)))
    )


def _round_number(claim: SynthClaim) -> None:
    claim.amount_claimed = Decimal(str(random.choice(ROUND_AMOUNTS)))
    claim.segment_data["forced_round_amount"] = True
    claim.documents = [d for d in claim.documents if d != "valuers_report"]


def _missing_documents(claim: SynthClaim) -> None:
    claim.documents = [d for d in claim.documents if d not in ("police_abstract", "valuers_report")]
    if float(claim.amount_claimed) < 60_000:
        claim.amount_claimed = Decimal(str(random.randint(60_000, 300_000)))


def _late_report(claim: SynthClaim) -> None:
    claim.reported_date = claim.incident_date + timedelta(days=random.randint(46, 120))
    claim.segment_data["days_to_report"] = (claim.reported_date - claim.incident_date).days


def _repeat_claimant(claim: SynthClaim) -> None:
    claim.segment_data["forced_prior_claims_count"] = random.randint(3, 7)
    claim.segment_data["forced_prior_claims_total"] = float(
        claim.amount_claimed * Decimal(str(random.randint(3, 7)))
    )


def _inflated_repair(claim: SynthClaim) -> None:
    claim.amount_claimed = Decimal(str(random.randint(350_000, 900_000)))
    claim.segment_data["forced_provider_claim_count_30d"] = random.randint(8, 20)
    claim.segment_data["forced_inflated_repair"] = True


FRAUD_PATTERNS = {
    "quick_claim_after_inception": _quick_claim,
    "duplicate_ob_number": _duplicate_ob,
    "provider_billing_spike": _provider_spike,
    "round_number_amount": _round_number,
    "missing_mandatory_documents": _missing_documents,
    "late_reporting": _late_report,
    "repeat_claimant": _repeat_claimant,
    "inflated_repair_estimate": _inflated_repair,
}
