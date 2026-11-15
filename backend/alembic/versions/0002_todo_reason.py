"""Persist optional AI selection reasons without changing existing tasks."""

import sqlalchemy as sa

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("todo_items", sa.Column("reason_code", sa.String(40), nullable=True))


def downgrade():
    op.drop_column("todo_items", "reason_code")
