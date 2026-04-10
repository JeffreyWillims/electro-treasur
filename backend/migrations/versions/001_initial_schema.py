"""Initial schema: Users, Categories, BudgetPlans, Transactions

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-03-20 10:33:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # 2. category_type_enum
    category_type_enum = postgresql.ENUM("income", "expense", name="category_type_enum")

    # 3. categories
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("type", category_type_enum, nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_categories_user_id"), "categories", ["user_id"], unique=False
    )

    # 4. budget_plans
    op.create_table(
        "budget_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column(
            "planned_amount",
            sa.Numeric(precision=12, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "category_id", "month", name="uq_budget_user_cat_month"
        ),
    )
    op.create_index(
        op.f("ix_budget_plans_category_id"),
        "budget_plans",
        ["category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_budget_plans_user_id"), "budget_plans", ["user_id"], unique=False
    )

    # 5. transactions
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "executed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("idempotency_key", postgresql.UUID(as_uuid=False), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key", name="uq_transaction_idempotency"),
    )
    op.create_index(
        op.f("ix_transactions_category_id"),
        "transactions",
        ["category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_transactions_user_id"), "transactions", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_transactions_user_id"), table_name="transactions")
    op.drop_index(op.f("ix_transactions_category_id"), table_name="transactions")
    op.drop_table("transactions")

    op.drop_index(op.f("ix_budget_plans_user_id"), table_name="budget_plans")
    op.drop_index(op.f("ix_budget_plans_category_id"), table_name="budget_plans")
    op.drop_table("budget_plans")

    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_table("categories")

    category_type_enum = postgresql.ENUM("income", "expense", name="category_type_enum")
    category_type_enum.drop(op.get_bind())

    op.drop_table("users")
