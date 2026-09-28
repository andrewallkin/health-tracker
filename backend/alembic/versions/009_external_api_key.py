"""add external api key columns on users

Revision ID: 009_external_api_key
Revises: 008_drop_saved_food_tags
Create Date: 2026-09-28
"""

from alembic import op
import sqlalchemy as sa


revision = "009_external_api_key"
down_revision = "008_drop_saved_food_tags"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("external_api_key_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("external_api_key_prefix", sa.String(length=16), nullable=True))
    op.add_column("users", sa.Column("external_api_key_created_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_external_api_key_prefix", "users", ["external_api_key_prefix"])


def downgrade() -> None:
    op.drop_index("ix_users_external_api_key_prefix", table_name="users")
    op.drop_column("users", "external_api_key_created_at")
    op.drop_column("users", "external_api_key_prefix")
    op.drop_column("users", "external_api_key_hash")
