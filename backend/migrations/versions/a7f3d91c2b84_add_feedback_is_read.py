"""отметка «прочитано» у обратной связи

Аддитивная миграция: колонка добавляется со server_default=false, поэтому
существующие строки заполняются автоматически и старый код, не знающий про
поле, продолжает работать (INSERT без is_read остаётся валидным).

Revision ID: a7f3d91c2b84
Revises: b9c0d1e2f3a4
Create Date: 2026-07-20 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "a7f3d91c2b84"
down_revision: str | None = "b9c0d1e2f3a4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "feedback",
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("feedback", "is_read")
