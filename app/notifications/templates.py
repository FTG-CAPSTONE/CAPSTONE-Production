from __future__ import annotations

from typing import Any, Dict


# ── Email templates ───────────────────────────────────────────────────────────

def email_decision_made(case_id: str, decision: str, claim_ref: str, amount: str) -> Dict[str, str]:
    decision_label = decision.upper()
    return {
        "subject": f"ClaimGuard: Claim {claim_ref} — {decision_label}",
        "html": f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#1e3a5f;padding:20px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">ClaimGuard</h1>
    <p style="color:#94a3b8;margin:4px 0 0">Claims Intelligence Platform</p>
  </div>
  <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0">
    <h2 style="margin:0 0 16px;color:#1e293b">Decision Recorded</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:140px">Claim Reference</td>
          <td style="padding:8px 0;font-weight:600">{claim_ref}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Amount</td>
          <td style="padding:8px 0">KES {amount}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Decision</td>
          <td style="padding:8px 0;font-weight:600;color:{'#16a34a' if decision=='approved' else '#dc2626'}">{decision_label}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:24px">
      View the full case detail at your ClaimGuard portal.
    </p>
  </div>
</div>""",
        "text": f"ClaimGuard: Claim {claim_ref} — Decision: {decision_label}. Amount: KES {amount}.",
    }


def email_fraud_alert(case_id: str, claim_ref: str, fraud_score: float, band: str) -> Dict[str, str]:
    return {
        "subject": f"ClaimGuard: High Fraud Alert — {claim_ref} (score {fraud_score:.0f})",
        "html": f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#dc2626;padding:20px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">⚠ Fraud Alert</h1>
  </div>
  <div style="background:#fff5f5;padding:32px;border-radius:0 0 8px 8px;border:1px solid #fecaca">
    <p>A claim has been flagged with a <strong>{band.upper()}</strong> fraud band.</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:140px">Claim</td>
          <td style="padding:8px 0;font-weight:600">{claim_ref}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Fraud Score</td>
          <td style="padding:8px 0;font-weight:700;color:#dc2626">{fraud_score:.1f} / 100</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Band</td>
          <td style="padding:8px 0;font-weight:600">{band.upper()}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:24px">
      This case has been added to the HITL review queue. Please review promptly.
    </p>
  </div>
</div>""",
        "text": f"FRAUD ALERT: Claim {claim_ref} scored {fraud_score:.0f}/100 ({band}). Review required.",
    }


def email_sla_breach_warning(
    case_id: str, claim_ref: str, days_open: int, days_remaining: int
) -> Dict[str, str]:
    urgency = "CRITICAL" if days_remaining <= 10 else "WARNING"
    color = "#dc2626" if days_remaining <= 10 else "#f59e0b"
    return {
        "subject": f"ClaimGuard SLA {urgency}: {claim_ref} — {days_remaining} days remaining",
        "html": f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:{color};padding:20px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">⏰ SLA {urgency}</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0">IRA 90-day statutory deadline</p>
  </div>
  <div style="background:#fffbeb;padding:32px;border-radius:0 0 8px 8px;border:1px solid #fde68a">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:160px">Claim</td>
          <td style="padding:8px 0;font-weight:600">{claim_ref}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Days open</td>
          <td style="padding:8px 0">{days_open}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b">Days remaining</td>
          <td style="padding:8px 0;font-weight:700;color:{color}">{days_remaining}</td></tr>
    </table>
    <p style="margin-top:16px;color:#92400e;font-size:13px">
      Under IRA Claims Management Guidelines, this claim must be resolved within 90 days
      or a 5% late-payment penalty applies.
    </p>
  </div>
</div>""",
        "text": f"SLA {urgency}: Claim {claim_ref} is {days_open} days old ({days_remaining} days until 90-day IRA deadline).",
    }


def email_queue_backlog(queue_size: int, oldest_days: int) -> Dict[str, str]:
    return {
        "subject": f"ClaimGuard: HITL Queue Backlog — {queue_size} cases pending",
        "html": f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#7c3aed;padding:20px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">Queue Backlog Alert</h1>
  </div>
  <div style="background:#f5f3ff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #ddd6fe">
    <p><strong>{queue_size}</strong> cases are pending in the HITL review queue.</p>
    <p>Oldest case has been waiting <strong>{oldest_days} day(s)</strong>.</p>
    <p style="color:#64748b;font-size:13px">Please review cases at your ClaimGuard portal.</p>
  </div>
</div>""",
        "text": f"HITL queue backlog: {queue_size} cases pending, oldest {oldest_days} days.",
    }


def email_override_rate_alert(override_rate: float, threshold: float) -> Dict[str, str]:
    pct = round(override_rate * 100, 1)
    thr = round(threshold * 100, 0)
    return {
        "subject": f"ClaimGuard: High Override Rate — {pct}% (threshold {thr:.0f}%)",
        "html": f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#ea580c;padding:20px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">Model Override Alert</h1>
  </div>
  <div style="background:#fff7ed;padding:32px;border-radius:0 0 8px 8px;border:1px solid #fed7aa">
    <p>The reviewer override rate over the last 30 days is <strong>{pct}%</strong>,
       above the configured threshold of {thr:.0f}%.</p>
    <p>This may indicate model drift. Consider retraining the fraud model.</p>
    <p style="color:#64748b;font-size:13px">Navigate to ML Admin → Retrain to generate a new challenger.</p>
  </div>
</div>""",
        "text": f"Override rate alert: {pct}% (threshold {thr:.0f}%). Consider retraining the fraud model.",
    }


# ── SMS templates ──────────────────────────────────────────────────────────────

def sms_claim_received(claim_ref: str) -> str:
    return f"ClaimGuard: Your claim {claim_ref} has been received and is being processed. Reference this number for all enquiries."


def sms_decision_made(claim_ref: str, decision: str) -> str:
    if decision == "approved":
        return f"ClaimGuard: Good news! Claim {claim_ref} has been APPROVED. You will be contacted with payment details shortly."
    elif decision == "declined":
        return f"ClaimGuard: Claim {claim_ref} has been DECLINED. You will receive a written explanation. You may dispute this decision."
    elif decision == "request_docs":
        return f"ClaimGuard: Action required for claim {claim_ref}. Additional documents are needed. Check your portal or call your agent."
    return f"ClaimGuard: Update on claim {claim_ref}: {decision.replace('_',' ').title()}. Contact your agent for details."


def sms_sla_warning(claim_ref: str, days_remaining: int) -> str:
    return f"ClaimGuard: Claim {claim_ref} requires attention. {days_remaining} days remaining before IRA deadline. Contact your insurer immediately."
