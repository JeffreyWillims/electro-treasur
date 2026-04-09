"""
SQLAlchemy 2.0 Declarative Models — Normalized Financial Domain.

Architectural invariants:
  • NUMERIC(12,2) for ALL monetary columns — no IEEE-754 float drift.
  • No day_1…day_31 denormalization — transactions table is the single source of truth.
  • idempotency_key on Transaction is UNIQUE — DB-level guard against double-writes.
  • executed_at uses TIMESTAMPTZ — timezone-aware by design.

Complexity:
  • INSERT  O(1) per transaction (B-Tree on idempotency_key).
  • SELECT  O(N) scan with index on (user_id, executed_at) for monthly aggregation.
"""

from __future__ import annotations

import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


class CategoryType(str, enum.Enum):
    """Discriminator for income vs expense categories."""

    income = "income"
    expense = "expense"


class User(Base):
    """Application user — authentication handled externally (JWT / OAuth2)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    monthly_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0"), default=Decimal("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ───────────────────────────────────────────────────
    categories: Mapped[list[Category]] = relationship(
        back_populates="user", lazy="selectin"
    )
    budgets: Mapped[list[Budget]] = relationship(back_populates="user", lazy="selectin")
    transactions: Mapped[list[Transaction]] = relationship(
        back_populates="user", lazy="selectin"
    )


class Category(Base):
    """Spending / income category bound to a single user."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    type: Mapped[CategoryType] = mapped_column(
        Enum(CategoryType, name="category_type_enum"), nullable=False
    )

    # ── Relationships ───────────────────────────────────────────────────
    user: Mapped[User] = relationship(back_populates="categories")
    parent: Mapped["Category"] = relationship(
        back_populates="subcategories", remote_side=[id]
    )
    subcategories: Mapped[list["Category"]] = relationship(back_populates="parent")
    budgets: Mapped[list["Budget"]] = relationship(back_populates="category")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")


class Budget(Base):
    """
    Monthly amount limit per category.
    """

    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category_id",
            "month",
            "year",
            name="uq_budget_user_cat_month_year",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    month: Mapped[int] = mapped_column(nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)
    amount_limit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0")
    )

    # ── Relationships ───────────────────────────────────────────────────
    user: Mapped[User] = relationship(back_populates="budgets")
    category: Mapped[Category] = relationship(back_populates="budgets")


class Transaction(Base):
    """
    Single financial fact — one row per real-world money movement.

    Race-condition protection:
      • `idempotency_key` is UNIQUE — INSERT with duplicate key raises IntegrityError.
      • Application layer checks Redis BEFORE hitting the DB (see transaction_service.py).
    """

    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_transaction_idempotency"),
        Index("ix_transaction_user_executed", "user_id", "executed_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, server_default="RUB"
    )
    is_recurring: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("false")
    )
    entry_type: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default="manual"
    )
    comment: Mapped[str | None] = mapped_column(String(255), nullable=True)

    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=False), nullable=True, unique=True
    )

    # ── Relationships ───────────────────────────────────────────────────
    user: Mapped[User] = relationship(back_populates="transactions")
    category: Mapped[Category] = relationship(back_populates="transactions")
