"""garmin settings columns

Revision ID: 006_garmin_settings
Revises: 005_day_statuses
Create Date: 2026-07-15
"""

from alembic import op
import sqlalchemy as sa


revision = "006_garmin_settings"
down_revision = "005_day_statuses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("garmin_email", sa.String(length=320), nullable=True))
    op.add_column("app_settings", sa.Column("garmin_tokens_encrypted", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("app_settings", "garmin_tokens_encrypted")
    op.drop_column("app_settings", "garmin_email")
