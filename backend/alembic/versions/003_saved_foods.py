"""saved foods and meal composition

Revision ID: 003_saved_foods
Revises: 002_check_ins
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa


revision = "003_saved_foods"
down_revision = "002_check_ins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_foods",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("calories", sa.Integer(), nullable=False),
        sa.Column("protein", sa.Float(), nullable=False),
        sa.Column("carbs", sa.Float(), nullable=False),
        sa.Column("fat", sa.Float(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_foods_user_id"), "saved_foods", ["user_id"], unique=False)

    op.add_column(
        "saved_meals",
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="manual"),
    )

    op.create_table(
        "saved_meal_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("meal_id", sa.String(length=36), nullable=False),
        sa.Column("food_id", sa.String(length=36), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["food_id"], ["saved_foods.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["meal_id"], ["saved_meals.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meal_id", "food_id", name="uq_saved_meal_items_meal_food"),
    )
    op.create_index(op.f("ix_saved_meal_items_meal_id"), "saved_meal_items", ["meal_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_meal_items_meal_id"), table_name="saved_meal_items")
    op.drop_table("saved_meal_items")
    op.drop_column("saved_meals", "kind")
    op.drop_index(op.f("ix_saved_foods_user_id"), table_name="saved_foods")
    op.drop_table("saved_foods")
