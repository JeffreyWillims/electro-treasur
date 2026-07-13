"""справочная таблица tax_rules + полнотекстовый поиск (FTS)

Revision ID: 7848b98b914b
Revises: f623ec9b0921
Create Date: 2026-07-08 08:35:12.256763

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# идентификаторы ревизии, используются Alembic.
revision: str = '7848b98b914b'
down_revision: Union[str, None] = 'f623ec9b0921'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.create_table('tax_rules',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('category', sa.String(length=64), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('source', sa.String(length=128), nullable=True),
    sa.Column('tsv', postgresql.TSVECTOR(), sa.Computed("setweight(to_tsvector('russian', coalesce(title,'')), 'A') || setweight(to_tsvector('russian', coalesce(body,'')), 'B')", persisted=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tax_rules_category'), 'tax_rules', ['category'], unique=False)
    op.create_index('ix_tax_rules_tsv', 'tax_rules', ['tsv'], unique=False, postgresql_using='gin')
    # ### конец команд Alembic ###

    # Заполняем бесплатным справочным контентом (tsv генерируется, поэтому вставляем только текстовые колонки).
    from src.data.tax_seed import TAX_RULES

    tax_rules = sa.table(
        "tax_rules",
        sa.column("category", sa.String),
        sa.column("title", sa.String),
        sa.column("body", sa.Text),
        sa.column("source", sa.String),
    )
    op.bulk_insert(tax_rules, TAX_RULES)


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_index('ix_tax_rules_tsv', table_name='tax_rules', postgresql_using='gin')
    op.drop_index(op.f('ix_tax_rules_category'), table_name='tax_rules')
    op.drop_table('tax_rules')
    # ### конец команд Alembic ###
