"""enable pg_trgm extension

Revision ID: 003
Revises: 002
Create Date: 2026-09-07

"""
from __future__ import annotations
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
