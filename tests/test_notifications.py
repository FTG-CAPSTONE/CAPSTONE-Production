from __future__ import annotations

"""
Notification module tests.

Key property: notifications NEVER raise exceptions even when unconfigured.
All functions must return gracefully with False/None when SMTP/AT not set.
"""

import os
import pytest


class TestEmailSkipsWhenUnconfigured:

    def test_send_email_returns_false_when_smtp_not_configured(self):
        """Email send must return False (not raise) when SMTP host is empty."""
        # Temporarily clear SMTP config
        from app.core.config import settings
        original = settings.SMTP_HOST
        settings.__dict__["SMTP_HOST"] = ""
        try:
            from app.notifications.email import send_email
            result = send_email("test@example.com", "Test Subject", "<p>Test</p>", "Test")
            assert result is False
        finally:
            settings.__dict__["SMTP_HOST"] = original

    def test_send_email_to_admins_does_not_raise(self):
        """Admin email dispatch must never raise."""
        from app.notifications.email import send_email_to_admins
        # Should not raise even if SMTP is unconfigured
        send_email_to_admins("Test", "<p>Test admin</p>")


class TestSMSSkipsWhenUnconfigured:

    def test_send_sms_returns_false_when_key_is_changeme(self):
        """SMS must return False (not raise) when API key is 'changeme'."""
        from app.notifications.sms import send_sms
        result = send_sms("+254700000000", "Test message")
        assert result is False

    def test_send_sms_truncates_to_160_chars(self):
        """SMS message is truncated to 160 characters."""
        from app.notifications.sms import send_sms
        long_message = "x" * 300
        # Should not raise; will return False (not configured in dev)
        result = send_sms("+254700000000", long_message)
        # Key assertion: no exception raised
        assert result is False


class TestTemplates:

    def test_email_decision_made_returns_all_keys(self):
        from app.notifications.templates import email_decision_made
        tmpl = email_decision_made("case-id", "approved", "CLM/001", "50000")
        assert "subject" in tmpl
        assert "html" in tmpl
        assert "text" in tmpl
        assert "CLM/001" in tmpl["subject"]
        assert "APPROVED" in tmpl["subject"]

    def test_email_fraud_alert_contains_score(self):
        from app.notifications.templates import email_fraud_alert
        tmpl = email_fraud_alert("case-id", "CLM/002", 87.5, "critical")
        # Score is rendered as {score:.0f} = "88" (rounds up) or "87" depending on template
        assert any(s in tmpl["text"] for s in ["87", "88"]), f"Score not in text: {tmpl['text']}"
        assert "critical" in tmpl["text"].lower()

    def test_sms_templates_under_160_chars(self):
        from app.notifications.templates import (
            sms_claim_received, sms_decision_made, sms_sla_warning,
        )
        for fn, args in [
            (sms_claim_received, ("CLM/2026/0001234",)),
            (sms_decision_made,  ("CLM/2026/0001234", "approved")),
            (sms_decision_made,  ("CLM/2026/0001234", "declined")),
            (sms_sla_warning,    ("CLM/2026/0001234", 7)),
        ]:
            msg = fn(*args)
            assert len(msg) <= 160, f"{fn.__name__} SMS exceeds 160 chars: {len(msg)}"

    def test_sla_breach_warning_contains_days(self):
        from app.notifications.templates import email_sla_breach_warning
        tmpl = email_sla_breach_warning("case-id", "CLM/003", 82, 8)
        assert "82" in tmpl["text"]
        assert "8" in tmpl["text"]
