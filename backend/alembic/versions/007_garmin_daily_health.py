"""garmin daily health cache

Revision ID: 007_garmin_daily_health
Revises: 006_garmin_settings
Create Date: 2026-07-18
"""

from alembic import op
import sqlalchemy as sa


revision = "007_garmin_daily_health"
down_revision = "006_garmin_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "garmin_daily_health",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.Column("is_complete", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="uq_garmin_daily_health_user_date"),
    )
    op.create_index(op.f("ix_garmin_daily_health_date"), "garmin_daily_health", ["date"], unique=False)
    op.create_index(op.f("ix_garmin_daily_health_user_id"), "garmin_daily_health", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_garmin_daily_health_user_id"), table_name="garmin_daily_health")
    op.drop_index(op.f("ix_garmin_daily_health_date"), table_name="garmin_daily_health")
    op.drop_table("garmin_daily_health")
