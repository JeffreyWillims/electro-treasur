"""add_comment_to_transactions

Revision ID: efe8619e215d
Revises: 6825ab5d3032
Create Date: 2026-04-01 19:47:30.042456

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "efe8619e215d"
down_revision: str | None = "6825ab5d3032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.add_column("transactions", sa.Column("comment", sa.String(length=255), nullable=True))
    # ### конец команд Alembic ###


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_column("transactions", "comment")
    # ### конец команд Alembic ###
