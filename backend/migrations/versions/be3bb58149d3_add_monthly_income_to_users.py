"""добавление monthly_income в users

Revision ID: be3bb58149d3
Revises: d05756d8f778
Create Date: 2026-03-29 17:19:51.027144

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "be3bb58149d3"
down_revision: str | None = "d05756d8f778"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.add_column(
        "users",
        sa.Column(
            "monthly_income",
            sa.Numeric(precision=12, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
    )
    # ### конец команд Alembic ###


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_column("users", "monthly_income")
    # ### конец команд Alembic ###
