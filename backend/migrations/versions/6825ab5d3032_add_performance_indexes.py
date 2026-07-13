"""add_performance_indexes

Revision ID: 6825ab5d3032
Revises: be3bb58149d3
Create Date: 2026-03-30 19:29:50.669110

"""

from collections.abc import Sequence

from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "6825ab5d3032"
down_revision: str | None = "be3bb58149d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.create_index(
        "ix_transaction_user_executed",
        "transactions",
        ["user_id", "executed_at"],
        unique=False,
    )
    # ### конец команд Alembic ###


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_index("ix_transaction_user_executed", table_name="transactions")
    # ### конец команд Alembic ###
