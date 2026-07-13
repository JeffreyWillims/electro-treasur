"""add_telegram_chat_id_to_users

Revision ID: a1b2c3d4e5f6
Revises: efe8619e215d
Create Date: 2026-05-27 14:15:00.000000

Добавляет колонку telegram_chat_id (BigInteger) в таблицу users.
UNIQUE-ограничение гарантирует, что один Telegram-аккаунт связан максимум с одним пользователем.
nullable=True позволяет существующим пользователям оставаться непривязанными.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "efe8619e215d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.add_column(
        "users",
        sa.Column(
            "telegram_chat_id",
            sa.BigInteger(),
            nullable=True,
        ),
    )
    op.create_unique_constraint(
        "uq_users_telegram_chat_id",
        "users",
        ["telegram_chat_id"],
    )
    # ### конец команд Alembic ###


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_constraint("uq_users_telegram_chat_id", "users", type_="unique")
    op.drop_column("users", "telegram_chat_id")
    # ### конец команд Alembic ###
