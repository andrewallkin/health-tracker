"""saved food image url

Revision ID: 004_saved_food_image_url
Revises: 003_saved_foods
Create Date: 2026-06-29
"""

from alembic import op
import sqlalchemy as sa


revision = "004_saved_food_image_url"
down_revision = "003_saved_foods"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "saved_foods",
        sa.Column("image_url", sa.String(length=512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("saved_foods", "image_url")
