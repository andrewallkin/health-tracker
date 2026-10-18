"""garmin metric snapshots

Revision ID: 010_garmin_metric_snapshots
Revises: 009_external_api_key
Create Date: 2026-10-18
"""

from alembic import op
import sqlalchemy as sa


revision = "010_garmin_metric_snapshots"
down_revision = "009_external_api_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "garmin_metric_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("snapshot_date", sa.String(length=10), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "snapshot_date", name="uq_garmin_metric_snapshots_user_date"),
    )
    op.create_index(op.f("ix_garmin_metric_snapshots_snapshot_date"), "garmin_metric_snapshots", ["snapshot_date"], unique=False)
    op.create_index(op.f("ix_garmin_metric_snapshots_user_id"), "garmin_metric_snapshots", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_garmin_metric_snapshots_user_id"), table_name="garmin_metric_snapshots")
    op.drop_index(op.f("ix_garmin_metric_snapshots_snapshot_date"), table_name="garmin_metric_snapshots")
    op.drop_table("garmin_metric_snapshots")
