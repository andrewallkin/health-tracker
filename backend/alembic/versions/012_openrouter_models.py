"""switch food models to OpenRouter ids

Revision ID: 012_openrouter_models
Revises: 011_hevy_integration
Create Date: 2026-11-13
"""

from alembic import op
import sqlalchemy as sa


revision = "012_openrouter_models"
down_revision = "011_hevy_integration"
branch_labels = None
depends_on = None

DEFAULT_FOOD_MODEL = "google/gemini-2.5-flash"


def upgrade() -> None:
    op.alter_column(
        "app_settings",
        "text_model",
        existing_type=sa.String(length=64),
        type_=sa.String(length=128),
        existing_nullable=False,
        server_default=DEFAULT_FOOD_MODEL,
    )
    op.alter_column(
        "app_settings",
        "image_model",
        existing_type=sa.String(length=64),
        type_=sa.String(length=128),
        existing_nullable=False,
        server_default=DEFAULT_FOOD_MODEL,
    )
    op.execute(
        "UPDATE app_settings SET text_model = 'google/gemini-2.5-flash' "
        "WHERE text_model NOT LIKE '%/%'"
    )
    op.execute(
        "UPDATE app_settings SET image_model = 'google/gemini-2.5-flash' "
        "WHERE image_model NOT LIKE '%/%'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE app_settings SET text_model = 'gpt-5-nano' "
        "WHERE text_model = 'google/gemini-2.5-flash'"
    )
    op.execute(
        "UPDATE app_settings SET image_model = 'gpt-5-mini' "
        "WHERE image_model = 'google/gemini-2.5-flash'"
    )
    op.alter_column(
        "app_settings",
        "text_model",
        existing_type=sa.String(length=128),
        type_=sa.String(length=64),
        existing_nullable=False,
        server_default="gpt-5-nano",
    )
    op.alter_column(
        "app_settings",
        "image_model",
        existing_type=sa.String(length=128),
        type_=sa.String(length=64),
        existing_nullable=False,
        server_default="gpt-5-mini",
    )
