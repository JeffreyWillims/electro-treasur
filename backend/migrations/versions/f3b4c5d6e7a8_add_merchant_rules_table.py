"""add merchant_rules table

Revision ID: f3b4c5d6e7a8
Revises: e7a8b9c0d1f2
Create Date: 2026-07-06 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3b4c5d6e7a8'
down_revision: str | None = 'e7a8b9c0d1f2'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'merchant_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('keyword', sa.String(length=64), nullable=False),
        sa.Column('category', sa.String(length=128), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('keyword'),
    )


def downgrade() -> None:
    op.drop_table('merchant_rules')
