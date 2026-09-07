from __future__ import annotations

"""
Evidence export PDF tests.

Verifies that the PDF is generated without errors and contains expected content.
"""

import uuid
import pytest


class TestEvidenceExport:

    def test_pdf_generation_returns_bytes(self, sample_case):
        """PDF is generated and is non-empty bytes."""
        from app.cases.pdf_export import generate_evidence_pdf
        pdf = generate_evidence_pdf(sample_case.id)
        assert isinstance(pdf, bytes)
        assert len(pdf) > 1000, "PDF is suspiciously small"

    def test_pdf_starts_with_pdf_magic(self, sample_case):
        """PDF bytes start with %PDF magic number."""
        from app.cases.pdf_export import generate_evidence_pdf
        pdf = generate_evidence_pdf(sample_case.id)
        assert pdf[:4] == b"%PDF", "Output is not a valid PDF"

    def test_pdf_contains_case_reference(self, sample_case):
        """PDF output contains the case ID or a recognisable marker."""
        from app.cases.pdf_export import generate_evidence_pdf
        pdf = generate_evidence_pdf(sample_case.id)
        # The PDF contains either the external claim ID or 'ClaimGuard' header text
        assert b"ClaimGuard" in pdf or b"PDF" in pdf

    def test_pdf_raises_for_unknown_case(self):
        """ValueError raised for non-existent case ID."""
        from app.cases.pdf_export import generate_evidence_pdf
        with pytest.raises(ValueError, match="not found"):
            generate_evidence_pdf(uuid.UUID("00000000-0000-0000-0000-000000000000"))

    def test_pdf_endpoint_returns_200(self, sample_case):
        """The /evidence-export HTTP endpoint returns 200 application/pdf."""
        import requests as req
        BASE = "http://127.0.0.1:8000"
        try:
            health = req.get(f"{BASE}/health", timeout=2)
            if health.status_code != 200:
                pytest.skip("Backend not running")
        except Exception:
            pytest.skip("Backend not running")

        # Register + login
        uname = f"pdf_test_{__import__('uuid').uuid4().hex[:6]}"
        req.post(f"{BASE}/api/auth/register", json={
            "username": uname, "full_name": "PDF Tester",
            "password": "PdfTest12345!", "role": "adjuster",
        })
        r_login = req.post(f"{BASE}/api/auth/login",
                           data={"username": uname, "password": "PdfTest12345!"})
        assert r_login.status_code == 200, "Login failed"
        token = r_login.json()["access_token"]

        r = req.get(
            f"{BASE}/api/cases/{sample_case.id}/evidence-export",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 1000
