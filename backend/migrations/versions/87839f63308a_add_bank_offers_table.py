"""добавление таблицы bank_offers

Revision ID: 87839f63308a
Revises: bb95b3b80349
Create Date: 2026-07-03 17:50:40.948336

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "87839f63308a"
down_revision: str | None = "bb95b3b80349"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.create_table(
        "bank_offers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("rate", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("color", sa.String(length=16), server_default="#888888", nullable=False),
        sa.Column("partner_url", sa.String(length=512), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("clicks", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    # ### конец команд Alembic ###

    # Заполнение: текущие захардкоженные пресеты фронтенда, чтобы UI не был пустым.
    # partner_url остаётся NULL, пока реальные CPA-ссылки не настроены через админку.
    op.execute(
        """
        INSERT INTO bank_offers (name, rate, color, sort_order) VALUES
          ('Альфа-Банк', 16.00, '#EF3124', 1),
          ('Т-Банк',     15.00, '#FFDD2D', 2),
          ('Сбер',       14.00, '#21A038', 3),
          ('ВТБ',        13.00, '#002882', 4),
          ('Газпромбанк',12.00, '#0071CE', 5)
        """
    )


def downgrade() -> None:
    # ### команды, автоматически сгенерированные Alembic — при необходимости скорректируйте! ###
    op.drop_table("bank_offers")
    # ### конец команд Alembic ###
