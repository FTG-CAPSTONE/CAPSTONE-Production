from __future__ import annotations

"""
Evidence export PDF generator.

Generates a downloadable PDF evidence pack for a case, containing:
  - Cover page with IRA regulatory statement
  - Case summary (claim type, amount, dates, status)
  - Party details (claimant, provider)
  - Policy summary
  - Rule evaluation results
  - ML prediction + SHAP top features
  - Full chronological audit trail

Uses reportlab (sync) — caller must wrap in run_in_executor.
"""

import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# ── Colours (ClaimGuard palette) ──────────────────────────────────────────────
NAVY   = colors.HexColor("#1e3a5f")
BLUE   = colors.HexColor("#2563eb")
GREEN  = colors.HexColor("#16a34a")
RED    = colors.HexColor("#dc2626")
AMBER  = colors.HexColor("#d97706")
GREY   = colors.HexColor("#64748b")
LIGHT  = colors.HexColor("#f8fafc")
WHITE  = colors.white
BLACK  = colors.black


def _styles():
    base = getSampleStyleSheet()
    custom = {
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"],
            fontSize=22, textColor=WHITE, spaceAfter=6, alignment=TA_CENTER,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub", parent=base["Normal"],
            fontSize=11, textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER,
        ),
        "section_heading": ParagraphStyle(
            "section_heading", parent=base["Heading2"],
            fontSize=11, textColor=NAVY, spaceBefore=14, spaceAfter=4,
            fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=9, textColor=BLACK, spaceAfter=3, leading=14,
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"],
            fontSize=8, textColor=GREY, spaceAfter=2, leading=12,
        ),
        "footer": ParagraphStyle(
            "footer", parent=base["Normal"],
            fontSize=7, textColor=GREY, alignment=TA_CENTER,
        ),
        "shap_feature": ParagraphStyle(
            "shap_feature", parent=base["Normal"],
            fontSize=8.5, textColor=BLACK, spaceAfter=2, leading=12,
        ),
    }
    return custom


def _table_style_default():
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR",  (0, 0), (-1, 0), WHITE),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT, WHITE]),
        ("GRID",       (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
    ])


def _kv_table(rows: list[tuple[str, str]], col_widths=(5*cm, 11*cm)):
    data = [[Paragraph(k, ParagraphStyle("k", fontSize=8.5, textColor=GREY, fontName="Helvetica-Bold")),
             Paragraph(str(v), ParagraphStyle("v", fontSize=8.5, textColor=BLACK))]
            for k, v in rows]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT, WHITE]),
        ("GRID",           (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING",    (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",   (0, 0), (-1, -1), 6),
        ("TOPPADDING",     (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN",         (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def generate_evidence_pdf(case_id: uuid.UUID) -> bytes:
    """
    Generate a complete evidence PDF for a case.
    Returns raw PDF bytes.

    Raises ValueError if the case is not found.
    """
    import app.users.models   # noqa: F401
    import app.cases.models   # noqa: F401
    import app.ml.models      # noqa: F401
    import app.hitl.models    # noqa: F401
    import app.quality.models # noqa: F401
    import app.rules.models   # noqa: F401
    import app.ingestion.models # noqa: F401

    from app.core.db import SyncSessionLocal
    from app.cases.models import Case, CaseEvent
    from app.rules.models import RuleEvaluation
    from app.ml.models import MLPrediction
    from sqlalchemy import select

    db = SyncSessionLocal()
    try:
        case = db.execute(
            select(Case).where(Case.id == case_id)
        ).scalar_one_or_none()

        if not case:
            raise ValueError(f"Case {case_id} not found")

        rules = db.execute(
            select(RuleEvaluation)
            .where(RuleEvaluation.case_id == case_id)
            .order_by(RuleEvaluation.evaluated_at)
        ).scalars().all()

        prediction = db.execute(
            select(MLPrediction)
            .where(MLPrediction.case_id == case_id)
            .order_by(MLPrediction.predicted_at.desc())
            .limit(1)
        ).scalar_one_or_none()

        events = db.execute(
            select(CaseEvent)
            .where(CaseEvent.case_id == case_id)
            .order_by(CaseEvent.occurred_at)
        ).scalars().all()

        # Resolve related objects
        from app.cases.models import Party, Policy
        claimant = db.get(Party, case.claimant_id) if case.claimant_id else None
        provider = db.get(Party, case.provider_id) if case.provider_id else None
        policy   = db.get(Policy, case.policy_id)  if case.policy_id  else None

    finally:
        db.close()

    return _build_pdf(case, rules, prediction, events, claimant, provider, policy)


def _build_pdf(case, rules, prediction, events, claimant, provider, policy) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )

    S = _styles()
    story = []
    page_width = A4[0] - 4*cm

    now_str = datetime.now(timezone.utc).strftime("%d %B %Y %H:%M UTC")
    claim_ref = case.external_claim_id or str(case.id)[:8].upper()
    amount_str = f"KES {float(case.amount_claimed or 0):,.0f}"

    # ── Cover banner ──────────────────────────────────────────────────────────
    cover_data = [[
        Paragraph("ClaimGuard", S["cover_title"]),
    ]]
    cover_sub_data = [[
        Paragraph(f"Evidence Export — {claim_ref}", S["cover_sub"]),
        Paragraph(f"Generated {now_str}", S["cover_sub"]),
    ]]
    cover_table = Table([[Paragraph("ClaimGuard — Evidence Export", ParagraphStyle(
        "ct", fontSize=18, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER,
    ))]], colWidths=[page_width])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 18),
        ("ROUNDEDCORNERS", [6]),
    ]))
    story.append(cover_table)
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(f"Case Reference: {claim_ref}", ParagraphStyle(
        "ref", fontSize=10, textColor=GREY, alignment=TA_CENTER, spaceAfter=2,
    )))
    story.append(Paragraph(f"Generated: {now_str}", ParagraphStyle(
        "gen", fontSize=9, textColor=GREY, alignment=TA_CENTER, spaceAfter=6,
    )))
    story.append(HRFlowable(width=page_width, color=colors.HexColor("#e2e8f0"), thickness=0.5))
    story.append(Spacer(1, 0.3*cm))

    ira_text = (
        "This document is an automatically generated evidence pack produced by ClaimGuard, "
        "a claims intelligence system operating in accordance with the Insurance Regulatory "
        "Authority (IRA) of Kenya's Claims Management Guidelines. It is intended solely for "
        "internal use by the insurer and its authorised representatives. "
        "All scores and recommendations are decision support only — final authority rests with "
        "the licensed underwriter."
    )
    story.append(Paragraph(ira_text, S["small"]))
    story.append(Spacer(1, 0.5*cm))

    # ── Section helper ────────────────────────────────────────────────────────
    def section(title: str):
        story.append(Paragraph(title, S["section_heading"]))
        story.append(HRFlowable(width=page_width, color=NAVY, thickness=0.8, spaceAfter=4))

    # ── 1. Case Summary ───────────────────────────────────────────────────────
    section("1. Case Summary")
    status_color = GREEN if case.status in ("approved", "auto_approved") else \
                   RED   if case.status in ("declined", "auto_rejected")  else GREY
    story.append(_kv_table([
        ("Reference",     claim_ref),
        ("Claim Type",    (case.claim_type or "—").replace("_", " ").title()),
        ("Amount Claimed", amount_str),
        ("Incident Date", str(case.incident_date or "—")),
        ("Reported Date", str(case.reported_date or "—")),
        ("Submitted",     case.submitted_at.strftime("%d %b %Y %H:%M UTC") if case.submitted_at else "—"),
        ("Status",        case.status.replace("_", " ").upper()),
        ("Fraud Score",   f"{float(case.fraud_score or 0):.1f} / 100 ({case.fraud_band or '—'})"),
        ("Complexity",    f"{float(case.complexity_score or 0):.0f} / 100"),
        ("Confidence",    f"{float(case.confidence or 0)*100:.0f}%"),
    ]))

    # ── 2. Parties ────────────────────────────────────────────────────────────
    section("2. Parties")
    if claimant:
        story.append(Paragraph("<b>Claimant</b>", S["body"]))
        story.append(_kv_table([
            ("Full Name", claimant.full_name),
            ("ID Number", claimant.id_number or "—"),
            ("Phone",     claimant.phone or "—"),
            ("County",    claimant.county or "—"),
        ]))
        story.append(Spacer(1, 0.3*cm))
    if provider:
        story.append(Paragraph("<b>Repairer / Provider</b>", S["body"]))
        story.append(_kv_table([
            ("Name",    provider.full_name),
            ("Type",    provider.party_type),
            ("County",  provider.county or "—"),
        ]))

    # ── 3. Policy ─────────────────────────────────────────────────────────────
    section("3. Policy")
    if policy:
        story.append(_kv_table([
            ("Policy Number",  policy.external_id or "—"),
            ("Product Line",   policy.product_line),
            ("Motor Class",    (policy.motor_class or "—").replace("_", " ").title()),
            ("Sum Insured",    f"KES {float(policy.sum_insured or 0):,.0f}"),
            ("Premium",        f"KES {float(policy.premium or 0):,.0f}"),
            ("Policy Period",  f"{policy.start_date} → {policy.end_date}"),
            ("Status",         policy.status.upper()),
        ]))
    else:
        story.append(Paragraph("Policy information not available.", S["small"]))

    # ── 4. Rule Evaluations ───────────────────────────────────────────────────
    section("4. Rule Evaluations")
    if rules:
        rule_rows = [["Rule Code", "Result", "Severity", "Details"]]
        for r in rules:
            result_color = RED   if r.result == "hard_fail" else \
                           AMBER if r.result == "soft_flag" else GREEN
            rule_rows.append([
                r.rule_code.replace("_", " ").title(),
                r.result.replace("_", " ").upper(),
                (r.severity or "—").upper(),
                str(r.triggered_value)[:80] if r.triggered_value else "—",
            ])
        t = Table(rule_rows, colWidths=[6*cm, 3*cm, 2.5*cm, 4.5*cm])
        t.setStyle(_table_style_default())
        story.append(t)
    else:
        story.append(Paragraph("No rule evaluations recorded.", S["small"]))

    # ── 5. ML Prediction + SHAP ───────────────────────────────────────────────
    section("5. ML Prediction & Explainability")
    if prediction:
        story.append(_kv_table([
            ("Fraud Score",  f"{float(prediction.score or 0):.1f} / 100"),
            ("Fraud Band",   (prediction.band or "—").upper()),
            ("Confidence",   f"{float(prediction.confidence or 0)*100:.0f}%"),
            ("Model Version", prediction.model_family or "—"),
            ("Predicted At", prediction.predicted_at.strftime("%d %b %Y %H:%M UTC") if prediction.predicted_at else "—"),
        ]))
        story.append(Spacer(1, 0.3*cm))
        shap_vals = prediction.shap_values or []
        if shap_vals:
            story.append(Paragraph("<b>Top Risk Drivers (SHAP)</b>", S["body"]))
            shap_rows = [["Feature", "Impact", "Value", "Direction"]]
            for sv in shap_vals[:5]:
                shap_rows.append([
                    sv.get("feature", "?").replace("_", " "),
                    f"{sv.get('impact', 0):.4f}",
                    str(sv.get("value", "—")),
                    "▲ Increases" if sv.get("direction") == "increases_risk" else "▼ Decreases",
                ])
            shap_t = Table(shap_rows, colWidths=[5.5*cm, 2.5*cm, 3*cm, 5*cm])
            shap_t.setStyle(_table_style_default())
            story.append(shap_t)
    else:
        story.append(Paragraph(
            "No ML prediction available. Train and promote a model to generate predictions.",
            S["small"]
        ))

    # ── 6. Audit Trail ────────────────────────────────────────────────────────
    section("6. Audit Trail")
    if events:
        audit_rows = [["Timestamp", "Event", "Actor", "Details"]]
        for ev in events:
            ts = ev.occurred_at.strftime("%d %b %Y %H:%M") if ev.occurred_at else "—"
            payload_str = ""
            if ev.payload:
                # Show key facts, not raw JSON
                interesting = {k: v for k, v in ev.payload.items()
                               if k in ("decision", "status", "reason", "fraud_score",
                                        "fraud_band", "hard_fails", "soft_flags", "outcome")}
                if interesting:
                    payload_str = "; ".join(f"{k}={v}" for k, v in interesting.items())
                else:
                    payload_str = str(ev.payload)[:60]

            audit_rows.append([
                ts,
                ev.event_type.replace("_", " ").title(),
                ev.actor or "system",
                payload_str[:80],
            ])
        audit_t = Table(audit_rows, colWidths=[3.5*cm, 3.5*cm, 3*cm, 6*cm])
        audit_t.setStyle(_table_style_default())
        story.append(audit_t)
    else:
        story.append(Paragraph("No audit events recorded.", S["small"]))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width=page_width, color=colors.HexColor("#e2e8f0"), thickness=0.5))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"Generated by ClaimGuard Claims Intelligence Platform · {now_str} · "
        "CONFIDENTIAL — Not for external distribution without insurer approval · "
        "All AI scores are decision-support only. Final authority rests with the licensed underwriter.",
        S["footer"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
