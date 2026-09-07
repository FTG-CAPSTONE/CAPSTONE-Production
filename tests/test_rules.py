from __future__ import annotations

"""
Rules engine unit tests.

Each rule gets both a TRIGGERING case (should fire) and a CLEAN case (should pass).
"""

import pytest
from app.rules.motor_rules import (
    MOTOR_RULE_FUNCTIONS,
    rule_amount_over_limit,
    rule_duplicate_claim_number,
    rule_late_reporting,
    rule_missing_mandatory_document,
    rule_provider_billing_spike,
    rule_quick_claim_after_inception,
    rule_repeat_claimant,
    rule_round_number_amount,
)

# ── Helper ────────────────────────────────────────────────────────────────────

CLEAN_FEATURES = {
    "days_since_inception": 180,
    "days_to_report": 3,
    "policy_age_days": 180,
    "vehicle_age_years": 5,
    "weekend_incident": 0,
    "hour_of_report": 10,
    "amount_claimed": 85000,
    "claim_to_limit_ratio": 0.11,
    "amount_over_limit": 0,
    "is_round_number": 0,
    "claim_amount_log": 11.35,
    "provider_claim_count_30d": 3,
    "provider_claim_count_90d": 8,
    "provider_claim_amount_30d": 250000,
    "prior_claims_count": 0,
    "prior_claims_total_amount": 0,
    "prior_motor_claims_count": 0,
    "document_completeness_score": 1.0,
    "has_police_abstract": 1,
    "has_valuers_report": 1,
    "has_repair_quotation": 1,
    "claim_type_encoded": 0,
    "motor_class_encoded": 0,
    "county_risk_tier": 3,
    "ob_number_duplicate": 0,
}


def _features(**overrides):
    f = dict(CLEAN_FEATURES)
    f.update(overrides)
    return f


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestCleanClaim:
    """All rules should pass on a clean claim."""

    def test_all_pass_on_clean(self):
        for rule_fn in MOTOR_RULE_FUNCTIONS:
            result = rule_fn(CLEAN_FEATURES)
            assert result["result"] == "pass", (
                f"{result['rule_code']} should PASS on clean claim but got {result['result']}"
            )

    def test_all_rules_have_required_keys(self):
        for rule_fn in MOTOR_RULE_FUNCTIONS:
            result = rule_fn(CLEAN_FEATURES)
            assert "rule_code" in result
            assert "result" in result
            assert "severity" in result
            assert "description" in result
            assert result["result"] in ("pass", "soft_flag", "hard_fail")


class TestAmountOverLimit:
    def test_triggers_hard_fail(self):
        f = _features(amount_over_limit=1, claim_to_limit_ratio=1.05)
        r = rule_amount_over_limit(f)
        assert r["result"] == "hard_fail"
        assert r["severity"] == "critical"
        assert r["triggered_value"] is not None

    def test_passes_when_within_limit(self):
        f = _features(amount_over_limit=0, claim_to_limit_ratio=0.5)
        r = rule_amount_over_limit(f)
        assert r["result"] == "pass"
        assert r["triggered_value"] is None


class TestMissingDocument:
    def test_hard_fail_when_score_very_low(self):
        f = _features(document_completeness_score=0.2)
        r = rule_missing_mandatory_document(f)
        assert r["result"] == "hard_fail"

    def test_passes_when_complete(self):
        f = _features(document_completeness_score=1.0)
        r = rule_missing_mandatory_document(f)
        assert r["result"] == "pass"

    def test_boundary_at_60pct(self):
        assert rule_missing_mandatory_document(_features(document_completeness_score=0.59))["result"] == "hard_fail"
        assert rule_missing_mandatory_document(_features(document_completeness_score=0.61))["result"] == "pass"


class TestQuickClaimAfterInception:
    def test_soft_flag_on_day_1(self):
        r = rule_quick_claim_after_inception(_features(days_since_inception=1))
        assert r["result"] == "soft_flag"

    def test_soft_flag_on_day_14(self):
        r = rule_quick_claim_after_inception(_features(days_since_inception=14))
        assert r["result"] == "soft_flag"

    def test_passes_on_day_15(self):
        r = rule_quick_claim_after_inception(_features(days_since_inception=15))
        assert r["result"] == "pass"


class TestDuplicateClaimNumber:
    def test_hard_fail_on_duplicate(self):
        r = rule_duplicate_claim_number(_features(ob_number_duplicate=1))
        assert r["result"] == "hard_fail"

    def test_passes_when_no_duplicate(self):
        r = rule_duplicate_claim_number(_features(ob_number_duplicate=0))
        assert r["result"] == "pass"


class TestProviderBillingSpike:
    def test_soft_flag_above_threshold(self):
        r = rule_provider_billing_spike(_features(provider_claim_count_30d=16))
        assert r["result"] == "soft_flag"

    def test_passes_at_threshold(self):
        r = rule_provider_billing_spike(_features(provider_claim_count_30d=15))
        assert r["result"] == "pass"


class TestRoundNumberAmount:
    def test_soft_flag_on_round_amount(self):
        r = rule_round_number_amount(_features(is_round_number=1))
        assert r["result"] == "soft_flag"

    def test_passes_on_non_round(self):
        r = rule_round_number_amount(_features(is_round_number=0))
        assert r["result"] == "pass"


class TestLateReporting:
    def test_soft_flag_above_30_days(self):
        r = rule_late_reporting(_features(days_to_report=31))
        assert r["result"] == "soft_flag"

    def test_passes_at_30_days(self):
        r = rule_late_reporting(_features(days_to_report=30))
        assert r["result"] == "pass"


class TestRepeatClaimant:
    def test_soft_flag_at_3_claims(self):
        r = rule_repeat_claimant(_features(prior_claims_count=3))
        assert r["result"] == "soft_flag"

    def test_passes_below_threshold(self):
        r = rule_repeat_claimant(_features(prior_claims_count=2))
        assert r["result"] == "pass"
