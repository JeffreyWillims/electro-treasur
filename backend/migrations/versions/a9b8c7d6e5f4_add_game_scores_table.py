"""добавление таблицы game_scores

Revision ID: a9b8c7d6e5f4
Revises: f3b4c5d6e7a8
Create Date: 2026-07-06 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: str | None = "f3b4c5d6e7a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "game_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("game", sa.String(length=16), nullable=False),
        sa.Column("score", sa.BigInteger(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "game", name="uq_game_scores_user_game"),
    )
    op.create_index(op.f("ix_game_scores_user_id"), "game_scores", ["user_id"], unique=False)
    op.create_index(op.f("ix_game_scores_game"), "game_scores", ["game"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_game_scores_game"), table_name="game_scores")
    op.drop_index(op.f("ix_game_scores_user_id"), table_name="game_scores")
    op.drop_table("game_scores")
