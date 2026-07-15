"""day statuses

Revision ID: 005_day_statuses
Revises: 004_saved_food_image_url
Create Date: 2026-07-15
"""

from alembic import op
import sqlalchemy as sa


revision = "005_day_statuses"
down_revision = "004_saved_food_image_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "day_statuses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("status_date", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "status_date", name="uq_day_statuses_user_date"),
    )
    op.create_index(op.f("ix_day_statuses_status_date"), "day_statuses", ["status_date"], unique=False)
    op.create_index(op.f("ix_day_statuses_user_id"), "day_statuses", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_day_statuses_user_id"), table_name="day_statuses")
    op.drop_index(op.f("ix_day_statuses_status_date"), table_name="day_statuses")
    op.drop_table("day_statuses")
