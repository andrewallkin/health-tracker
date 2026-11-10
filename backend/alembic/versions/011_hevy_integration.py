"""hevy integration

Revision ID: 011_hevy_integration
Revises: 010_garmin_metric_snapshots
Create Date: 2026-11-10
"""

from alembic import op
import sqlalchemy as sa


revision = "011_hevy_integration"
down_revision = "010_garmin_metric_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hevy_exercise_templates",
        sa.Column("id", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("primary_muscle_group", sa.String(length=32), nullable=False),
        sa.Column("secondary_muscle_groups", sa.JSON(), nullable=False),
        sa.Column("equipment", sa.String(length=32), nullable=False),
        sa.Column("is_custom", sa.Boolean(), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_hevy_exercise_templates_primary_muscle_group"), "hevy_exercise_templates", ["primary_muscle_group"], unique=False)
    op.create_index(op.f("ix_hevy_exercise_templates_equipment"), "hevy_exercise_templates", ["equipment"], unique=False)
    op.create_table(
        "hevy_workouts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("routine_id", sa.String(length=36), nullable=True),
        sa.Column("local_date", sa.String(length=10), nullable=False),
        sa.Column("garmin_activity_ids", sa.JSON(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "id", name="uq_hevy_workouts_user_id"),
    )
    op.create_index(op.f("ix_hevy_workouts_user_id"), "hevy_workouts", ["user_id"], unique=False)
    op.create_index(op.f("ix_hevy_workouts_start_time"), "hevy_workouts", ["start_time"], unique=False)
    op.create_index(op.f("ix_hevy_workouts_local_date"), "hevy_workouts", ["local_date"], unique=False)
    op.create_table(
        "hevy_sync_state",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("last_event_processed_at", sa.DateTime(), nullable=True),
        sa.Column("templates_synced_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_hevy_sync_state_user_id"), "hevy_sync_state", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_hevy_sync_state_user_id"), table_name="hevy_sync_state")
    op.drop_table("hevy_sync_state")
    op.drop_index(op.f("ix_hevy_workouts_local_date"), table_name="hevy_workouts")
    op.drop_index(op.f("ix_hevy_workouts_start_time"), table_name="hevy_workouts")
    op.drop_index(op.f("ix_hevy_workouts_user_id"), table_name="hevy_workouts")
    op.drop_table("hevy_workouts")
    op.drop_index(op.f("ix_hevy_exercise_templates_equipment"), table_name="hevy_exercise_templates")
    op.drop_index(op.f("ix_hevy_exercise_templates_primary_muscle_group"), table_name="hevy_exercise_templates")
    op.drop_table("hevy_exercise_templates")
