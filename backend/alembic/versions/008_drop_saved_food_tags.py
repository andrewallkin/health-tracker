"""drop saved_foods.tags

Revision ID: 008_drop_saved_food_tags
Revises: 007_garmin_daily_health
Create Date: 2026-07-19
"""

from alembic import op
import sqlalchemy as sa


revision = "008_drop_saved_food_tags"
down_revision = "007_garmin_daily_health"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("saved_foods", "tags")


def downgrade() -> None:
    op.add_column(
        "saved_foods",
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
    )
