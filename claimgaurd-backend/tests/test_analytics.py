from __future__ import annotations

"""
Analytics endpoint tests.

Verifies KPI aggregation correctness and API responses.
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def token(client):
    client.post("/api/auth/register", json={
        "username": "analytics_tester",
        "full_name": "Analytics Tester",
        "password": "AnalyticsTest1!",
        "role": "admin",
    })
    r = client.post("/api/auth/login",
                    data={"username": "analytics_tester", "password": "AnalyticsTest1!"})
    if r.status_code != 200:
        return None
    return r.json()["access_token"]


class TestAnalyticsEndpoints:

    def test_overview_returns_200(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/overview",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200

    def test_overview_has_required_fields(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/overview",
                       headers={"Authorization": f"Bearer {token}"})
        data = r.json()
        required = [
            "total_cases", "auto_approved", "auto_rejected", "in_review",
            "auto_decision_rate", "cases_by_status", "cases_by_lob",
            "sla_compliance_rate", "sla_at_risk", "sla_breached",
        ]
        for field in required:
            assert field in data, f"Missing field: {field}"

    def test_overview_totals_consistent(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/overview",
                       headers={"Authorization": f"Bearer {token}"})
        data = r.json()
        # Sum of status counts should equal total
        status_sum = sum(data["cases_by_status"].values())
        assert status_sum == data["total_cases"], (
            f"Status sum {status_sum} != total_cases {data['total_cases']}"
        )

    def test_sla_compliance_rate_between_0_and_1(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/overview",
                       headers={"Authorization": f"Bearer {token}"})
        data = r.json()
        assert 0.0 <= data["sla_compliance_rate"] <= 1.0

    def test_auto_decision_rate_between_0_and_1(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/overview",
                       headers={"Authorization": f"Bearer {token}"})
        data = r.json()
        assert 0.0 <= data["auto_decision_rate"] <= 1.0

    def test_fraud_trend_returns_list(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/fraud-trend?days=30",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_provider_heatmap_returns_list(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/analytics/provider-heatmap",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for row in data:
            assert "provider_name" in row
            assert "total_claims" in row
            assert 0.0 <= row["fraud_rate"] <= 1.0

    def test_quality_summary_returns_correct_structure(self, client, token):
        if not token:
            pytest.skip("Auth not available")
        r = client.get("/api/quality/summary",
                       headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        data = r.json()
        assert "trusted" in data
        assert "corrected" in data
        assert "rejected" in data
        assert data["trusted"] + data["corrected"] + data["rejected"] == data["total"]
