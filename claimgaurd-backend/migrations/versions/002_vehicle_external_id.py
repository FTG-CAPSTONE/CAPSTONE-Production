"""add external_id to vehicle

Revision ID: 002
Revises: 001
Create Date: 2026-09-07

"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vehicle", sa.Column("external_id", sa.String(200), nullable=True))
    op.create_index("ix_vehicle_external_id", "vehicle", ["external_id"])


def downgrade() -> None:
    op.drop_index("ix_vehicle_external_id", "vehicle")
    op.drop_column("vehicle", "external_id")
