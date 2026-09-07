"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-09-06

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── app_role ──────────────────────────────────────────────────────────────
    op.create_table(
        "app_role",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
    )

    # ── app_user ──────────────────────────────────────────────────────────────
    op.create_table(
        "app_user",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(200), unique=True),
        sa.Column("hashed_password", sa.String(200), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_role.id")),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_app_user_username", "app_user", ["username"])
    op.create_index("ix_app_user_email", "app_user", ["email"])

    # ── party ─────────────────────────────────────────────────────────────────
    op.create_table(
        "party",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(200)),
        sa.Column("party_type", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(300), nullable=False),
        sa.Column("id_number", sa.String(50)),
        sa.Column("phone", sa.String(30)),
        sa.Column("email", sa.String(200)),
        sa.Column("county", sa.String(100)),
        sa.Column("kra_pin", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_party_external_id", "party", ["external_id"])
    op.create_index("ix_party_id_number", "party", ["id_number"])
    op.create_index("ix_party_kra_pin", "party", ["kra_pin"])

    # ── vehicle ───────────────────────────────────────────────────────────────
    op.create_table(
        "vehicle",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("party_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("party.id")),
        sa.Column("registration", sa.String(30), unique=True),
        sa.Column("make", sa.String(100)),
        sa.Column("model", sa.String(100)),
        sa.Column("year", sa.Integer()),
        sa.Column("chassis_number", sa.String(100)),
        sa.Column("engine_number", sa.String(100)),
        sa.Column("body_type", sa.String(50)),
        sa.Column("color", sa.String(50)),
        sa.Column("use_type", sa.String(50)),
    )
    op.create_index("ix_vehicle_registration", "vehicle", ["registration"])

    # ── policy ────────────────────────────────────────────────────────────────
    op.create_table(
        "policy",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(200), unique=True),
        sa.Column("policyholder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("party.id")),
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vehicle.id")),
        sa.Column("product_line", sa.String(50), nullable=False),
        sa.Column("motor_class", sa.String(50)),
        sa.Column("sum_insured", sa.Numeric(15, 2)),
        sa.Column("premium", sa.Numeric(15, 2)),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("agent_code", sa.String(50)),
        sa.Column("branch_code", sa.String(50)),
        sa.Column("status", sa.String(20), default="active"),
    )
    op.create_index("ix_policy_external_id", "policy", ["external_id"])

    # ── case ──────────────────────────────────────────────────────────────────
    op.create_table(
        "case",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_type", sa.String(30), nullable=False),
        sa.Column("line_of_business", sa.String(50), nullable=False),
        sa.Column("claim_type", sa.String(50)),
        sa.Column("external_claim_id", sa.String(200), unique=True),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("policy.id")),
        sa.Column("claimant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("party.id")),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("party.id")),
        sa.Column("amount_claimed", sa.Numeric(15, 2)),
        sa.Column("amount_approved", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(10), default="KES"),
        sa.Column("incident_date", sa.Date()),
        sa.Column("reported_date", sa.Date()),
        sa.Column("status", sa.String(30), default="received"),
        sa.Column("fraud_score", sa.Numeric(5, 2)),
        sa.Column("risk_score", sa.Numeric(5, 2)),
        sa.Column("fraud_band", sa.String(20)),
        sa.Column("complexity_score", sa.Numeric(5, 2)),
        sa.Column("confidence", sa.Numeric(5, 4)),
        sa.Column("segment_data", postgresql.JSONB()),
        sa.Column("notes", sa.Text()),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_case_external_claim_id", "case", ["external_claim_id"])
    op.create_index("ix_case_line_of_business", "case", ["line_of_business"])
    op.create_index("ix_case_status", "case", ["status"])
    op.create_index("ix_case_submitted_at", "case", ["submitted_at"])

    # ── case_line_item ────────────────────────────────────────────────────────
    op.create_table(
        "case_line_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("amount", sa.Numeric(15, 2)),
        sa.Column("item_type", sa.String(50)),
    )

    # ── document ──────────────────────────────────────────────────────────────
    op.create_table(
        "document",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("doc_type", sa.String(100), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(300)),
        sa.Column("mime_type", sa.String(100)),
        sa.Column("file_size_bytes", sa.Integer()),
        sa.Column("checksum", sa.String(64)),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
    )

    # ── case_event ────────────────────────────────────────────────────────────
    op.create_table(
        "case_event",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor", sa.String(100)),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_case_event_case_id", "case_event", ["case_id"])
    op.create_index("ix_case_event_occurred_at", "case_event", ["occurred_at"])

    # ── raw_intake ────────────────────────────────────────────────────────────
    op.create_table(
        "raw_intake",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("external_ref", sa.String(200)),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("etl_status", sa.String(20), default="pending"),
        sa.Column("error_message", sa.Text()),
    )
    op.create_index("ix_raw_intake_external_ref", "raw_intake", ["external_ref"])
    op.create_index("ix_raw_intake_etl_status", "raw_intake", ["etl_status"])
    op.create_index("ix_raw_intake_received_at", "raw_intake", ["received_at"])

    # ── ingest_log ────────────────────────────────────────────────────────────
    op.create_table(
        "ingest_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("batch_id", sa.String(100)),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("trusted_count", sa.Integer(), default=0),
        sa.Column("corrected_count", sa.Integer(), default=0),
        sa.Column("rejected_count", sa.Integer(), default=0),
        sa.Column("checksum", sa.String(64)),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ingest_log_batch_id", "ingest_log", ["batch_id"])

    # ── rule_evaluation ───────────────────────────────────────────────────────
    op.create_table(
        "rule_evaluation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("rule_code", sa.String(100), nullable=False),
        sa.Column("rule_version", sa.String(20), default="v1"),
        sa.Column("result", sa.String(20), nullable=False),
        sa.Column("severity", sa.String(20)),
        sa.Column("triggered_value", postgresql.JSONB()),
        sa.Column("description", sa.Text()),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rule_evaluation_case_id", "rule_evaluation", ["case_id"])

    # ── feature_snapshot ──────────────────────────────────────────────────────
    op.create_table(
        "feature_snapshot",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("features", postgresql.JSONB(), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_feature_snapshot_case_id", "feature_snapshot", ["case_id"])

    # ── model_registry ────────────────────────────────────────────────────────
    op.create_table(
        "model_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("model_family", sa.String(50), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("algorithm", sa.String(100)),
        sa.Column("status", sa.String(20), default="challenger"),
        sa.Column("artifact_path", sa.Text()),
        sa.Column("feature_names", postgresql.JSONB()),
        sa.Column("precision", sa.Numeric(6, 4)),
        sa.Column("recall", sa.Numeric(6, 4)),
        sa.Column("f1_score", sa.Numeric(6, 4)),
        sa.Column("auc_roc", sa.Numeric(6, 4)),
        sa.Column("false_positive_rate", sa.Numeric(6, 4)),
        sa.Column("trained_rows", sa.Integer()),
        sa.Column("promoted_at", sa.DateTime(timezone=True)),
        sa.Column("promoted_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_model_registry_model_family", "model_registry", ["model_family"])
    op.create_index("ix_model_registry_status", "model_registry", ["status"])

    # ── training_run ──────────────────────────────────────────────────────────
    op.create_table(
        "training_run",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("model_registry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("model_registry.id")),
        sa.Column("triggered_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
        sa.Column("rows_used", sa.Integer()),
        sa.Column("fraud_rate", sa.Numeric(6, 4)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), default="running"),
        sa.Column("error_message", sa.Text()),
    )

    # ── ml_prediction ─────────────────────────────────────────────────────────
    op.create_table(
        "ml_prediction",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("model_registry_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("model_registry.id")),
        sa.Column("feature_snapshot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("feature_snapshot.id")),
        sa.Column("model_family", sa.String(50)),
        sa.Column("score", sa.Numeric(5, 2)),
        sa.Column("band", sa.String(20)),
        sa.Column("confidence", sa.Numeric(5, 4)),
        sa.Column("shap_values", postgresql.JSONB()),
        sa.Column("predicted_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ml_prediction_case_id", "ml_prediction", ["case_id"])

    # ── model_feedback ────────────────────────────────────────────────────────
    op.create_table(
        "model_feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("prediction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ml_prediction.id")),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("rating", sa.String(20)),
        sa.Column("note", sa.Text()),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_model_feedback_case_id", "model_feedback", ["case_id"])

    # ── review_queue_item ─────────────────────────────────────────────────────
    op.create_table(
        "review_queue_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False, unique=True),
        sa.Column("priority_score", sa.Numeric(10, 2)),
        sa.Column("reason", sa.String(100)),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
        sa.Column("status", sa.String(20), default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_review_queue_item_case_id", "review_queue_item", ["case_id"])
    op.create_index("ix_review_queue_item_status", "review_queue_item", ["status"])
    op.create_index("ix_review_queue_item_priority_score", "review_queue_item", ["priority_score"])

    # ── review_decision ───────────────────────────────────────────────────────
    op.create_table(
        "review_decision",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("reviewer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id"), nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("overridden_score", sa.Numeric(5, 2)),
        sa.Column("is_override", sa.Boolean(), default=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_review_decision_case_id", "review_decision", ["case_id"])

    # ── investigation ─────────────────────────────────────────────────────────
    op.create_table(
        "investigation",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id"), nullable=False),
        sa.Column("investigator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("app_user.id")),
        sa.Column("status", sa.String(20), default="open"),
        sa.Column("notes", sa.Text()),
        sa.Column("findings", postgresql.JSONB()),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("outcome", sa.String(50)),
    )
    op.create_index("ix_investigation_case_id", "investigation", ["case_id"])
    op.create_index("ix_investigation_status", "investigation", ["status"])

    # ── data_quality_event ────────────────────────────────────────────────────
    op.create_table(
        "data_quality_event",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("case.id")),
        sa.Column("ingest_log_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ingest_log.id")),
        sa.Column("field_name", sa.String(100)),
        sa.Column("issue_type", sa.String(100)),
        sa.Column("raw_value", sa.Text()),
        sa.Column("decision", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_data_quality_event_case_id", "data_quality_event", ["case_id"])
    op.create_index("ix_data_quality_event_created_at", "data_quality_event", ["created_at"])

    # ── Seed default roles ────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO app_role (id, name, description) VALUES
          (gen_random_uuid(), 'admin',          'Full system access'),
          (gen_random_uuid(), 'underwriter',    'Underwriting review and decisions'),
          (gen_random_uuid(), 'adjuster',       'Claims adjustment and decisions'),
          (gen_random_uuid(), 'investigator',   'Fraud investigation'),
          (gen_random_uuid(), 'ml_admin',       'ML model governance'),
          (gen_random_uuid(), 'compliance',     'Compliance and audit access'),
          (gen_random_uuid(), 'corporate_risk', 'Corporate risk register access'),
          (gen_random_uuid(), 'viewer',         'Read-only access')
        ON CONFLICT (name) DO NOTHING
    """)


def downgrade() -> None:
    for table in [
        "data_quality_event", "investigation", "review_decision", "review_queue_item",
        "model_feedback", "ml_prediction", "training_run", "model_registry",
        "feature_snapshot", "rule_evaluation", "ingest_log", "raw_intake",
        "case_event", "document", "case_line_item", "case",
        "policy", "vehicle", "party", "app_user", "app_role",
    ]:
        op.drop_table(table)
