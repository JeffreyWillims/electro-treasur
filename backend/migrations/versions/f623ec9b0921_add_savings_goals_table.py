"""добавление таблицы savings_goals

Revision ID: f623ec9b0921
Revises: a9b8c7d6e5f4
Create Date: 2026-07-07 22:02:55.309629

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# идентификаторы ревизии, используются Alembic.
revision: str = 'f623ec9b0921'
down_revision: Union[str, None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.create_table('savings_goals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=128), nullable=False),
    sa.Column('target_amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('target_date', sa.Date(), nullable=True),
    sa.Column('monthly_plan', sa.Numeric(precision=12, scale=2), nullable=True),
    sa.Column('current_amount', sa.Numeric(precision=12, scale=2), server_default=sa.text('0'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_savings_goals_user_id'), 'savings_goals', ['user_id'], unique=False)
    # ### конец команд Alembic ###


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_index(op.f('ix_savings_goals_user_id'), table_name='savings_goals')
    op.drop_table('savings_goals')
    # ### конец команд Alembic ###
