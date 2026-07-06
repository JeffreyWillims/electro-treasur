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
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


class CategoryType(enum.StrEnum):
    """Discriminator for income vs expense categories."""

    income = "income"
    expense = "expense"


class UserRole(enum.StrEnum):
    """RBAC role. CONSULTANT gets read-only access to granting clients' data."""

    user = "user"
    consultant = "consultant"


class User(Base):
    """Application user — authentication handled externally (JWT / OAuth2)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"),
        nullable=False,
        server_default="user",
        default=UserRole.user,
    )
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    monthly_income: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, server_default=text("0"), default=Decimal("0")
    )
    telegram_chat_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # ── Relationships ───────────────────────────────────────────────────
    # passive_deletes=True: полагаемся на ON DELETE CASCADE в БД, а не на попытку
    # ORM обнулить NOT NULL внешние ключи детей (иначе NotNullViolationError).
    #
    # lazy="raise_on_sql": НЕ грузим коллекции автоматически. Раньше здесь стоял
    # "selectin", из-за чего get_user_by_email (вызывается на КАЖДОМ авторизованном
    # запросе) тянул всю историю транзакций юзера в память. Теперь коллекции нужно
    # грузить явно через selectinload() там, где они реально нужны (см. телеграм-
    # мидлвар для categories); случайный ленивый доступ упадёт с понятной ошибкой.
    # Явный selectinload() эту защиту переопределяет и работает как раньше.
    categories: Mapped[list[Category]] = relationship(
        back_populates="user", lazy="raise_on_sql", passive_deletes=True
    )
    budgets: Mapped[list[Budget]] = relationship(
        back_populates="user", lazy="raise_on_sql", passive_deletes=True
    )
    transactions: Mapped[list[Transaction]] = relationship(
        back_populates="user", lazy="raise_on_sql", passive_deletes=True
    )


class Category(Base):
    """Spending / income category bound to a single user."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
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
    parent: Mapped[Category] = relationship(back_populates="subcategories", remote_side=[id])
    subcategories: Mapped[list[Category]] = relationship(back_populates="parent")
    budgets: Mapped[list[Budget]] = relationship(back_populates="category", passive_deletes=True)
    transactions: Mapped[list[Transaction]] = relationship(
        back_populates="category", passive_deletes=True
    )


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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="RUB")
    is_recurring: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    entry_type: Mapped[str] = mapped_column(String(32), nullable=False, server_default="manual")
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


class BankOffer(Base):
    """
    Partner deposit offer shown in Savings Navigator (CPA monetization).

    Rates are editable via SQLAdmin; `clicks` is a raw funnel counter for
    partner negotiations. `partner_url` is the CPA tracking link.
    """

    __tablename__ = "bank_offers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False, server_default="#888888")
    partner_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    clicks: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Feedback(Base):
    """User feedback message. Persisted for audit; email delivery via EmailService."""

    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class GameScore(Base):
    """Лучший результат пользователя в игре Citrine Arcade — одна строка на (user, game)."""

    __tablename__ = "game_scores"
    __table_args__ = (UniqueConstraint("user_id", "game", name="uq_game_scores_user_game"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    game: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    score: Mapped[int] = mapped_column(BigInteger, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ConsultantAccess(Base):
    """
    Read-only grant: consultant может ЧИТАТЬ транзакции клиента.

    Грант создаёт сам клиент (по email консультанта) — консультант не может
    выдать себе доступ к чужим данным. Одна пара (consultant, client) — одна строка.
    """

    __tablename__ = "consultant_access"
    __table_args__ = (UniqueConstraint("consultant_id", "client_id", name="uq_consultant_client"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    consultant_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ApiKey(Base):
    """
    API-ключ для публичного /api/v2/public (сторонние сервисы).

    Секрет хранится ТОЛЬКО как Argon2-хэш (как пароли); полный ключ показывается
    один раз при создании. `prefix` — открытая часть ключа для O(1) поиска по
    UNIQUE-индексу без перебора хэшей.
    """

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MerchantRule(Base):
    """
    Пользовательское правило «ключевое слово мерчанта → категория» для AI Vision.

    Дополняет/переопределяет встроенный словарь MERCHANT_TO_CATEGORY
    (ai_vision_service) без релиза — правила редактируются через SQLAdmin.
    """

    __tablename__ = "merchant_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    keyword: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Insight(Base):
    """
    Persisted LLM financial insight for one user over one period.

    One row per (user, period). Re-running an analysis upserts on the unique
    constraint, so a month is never duplicated.
    """

    __tablename__ = "insights"
    __table_args__ = (
        UniqueConstraint("user_id", "period_start", "period_end", name="uq_insight_user_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    advice: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model_used: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
