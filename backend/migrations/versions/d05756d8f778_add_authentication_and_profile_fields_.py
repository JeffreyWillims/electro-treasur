"""Добавление полей аутентификации и профиля в users

Revision ID: d05756d8f778
Revises: 2898dc65dcd1
Create Date: 2026-03-29 14:56:02.224557

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "d05756d8f778"
down_revision: str | None = "2898dc65dcd1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.add_column(
        "users",
        sa.Column(
            "hashed_password",
            sa.String(length=255),
            nullable=False,
            server_default="REPLACE_ME_BY_RESET",
        ),
    )
    op.add_column("users", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(length=20), nullable=True))
    # ### конец команд Alembic ###


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_column("users", "phone")
    op.drop_column("users", "full_name")
    op.drop_column("users", "hashed_password")
    # ### конец команд Alembic ###
