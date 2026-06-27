"""check ins

Revision ID: 002_check_ins
Revises: 001_initial_schema
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa


revision = "002_check_ins"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "check_ins",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("check_in_date", sa.String(length=10), nullable=False),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "check_in_date", name="uq_check_ins_user_date"),
    )
    op.create_index(op.f("ix_check_ins_check_in_date"), "check_ins", ["check_in_date"], unique=False)
    op.create_index(op.f("ix_check_ins_user_id"), "check_ins", ["user_id"], unique=False)

    op.create_table(
        "check_in_photos",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("check_in_id", sa.String(length=36), nullable=False),
        sa.Column("image_url", sa.String(length=512), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["check_in_id"], ["check_ins.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_check_in_photos_check_in_id"), "check_in_photos", ["check_in_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_check_in_photos_check_in_id"), table_name="check_in_photos")
    op.drop_table("check_in_photos")
    op.drop_index(op.f("ix_check_ins_user_id"), table_name="check_ins")
    op.drop_index(op.f("ix_check_ins_check_in_date"), table_name="check_ins")
    op.drop_table("check_ins")
