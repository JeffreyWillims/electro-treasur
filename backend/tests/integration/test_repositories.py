"""
tests/integration/test_repositories.py — Repository Layer Integration Tests.

Tests ORM model constraints, indexes, and CASCADE behavior directly
against PostgreSQL. Uses the Nested Savepoint Isolation from conftest.py.

Architecture:
  ┌────────────────────────────────────────────────────────────────┐
  │  Integration Test Layer                                        │
  │                                                                │
  │  db_session ──→ ORM INSERT/SELECT ──→ PostgreSQL (test DB)     │
  │       ↓                                    ↓                   │
  │  SAVEPOINT                          Constraint checks          │
  │  (rolled back per test)             (UNIQUE, FK, CASCADE)      │
  └────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Budget, Category, CategoryType, Transaction, User


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FIXTURES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest.fixture
async def repo_user(db_session: AsyncSession) -> User:
    """Create a test user for repository tests."""
    user = User(
        email="repo-test@citrine.dev",
        hashed_password="$argon2id$fake_hash",
        full_name="Repo Tester",
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.fixture
async def repo_category(db_session: AsyncSession, repo_user: User) -> Category:
    """Create a test expense category."""
    cat = Category(
        user_id=repo_user.id,
        name="Продукты",
        type=CategoryType.expense,
        icon="#FF7A00",
    )
    db_session.add(cat)
    await db_session.flush()
    return cat


@pytest.fixture
async def income_category(db_session: AsyncSession, repo_user: User) -> Category:
    """Create a test income category."""
    cat = Category(
        user_id=repo_user.id,
        name="Зарплата",
        type=CategoryType.income,
        icon="#10B981",
    )
    db_session.add(cat)
    await db_session.flush()
    return cat


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST: Transaction UNIQUE idempotency_key
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionIdempotency:
    """Verify DB-level UNIQUE constraint on idempotency_key."""

    async def test_duplicate_idempotency_key_raises_integrity_error(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """
        GIVEN two transactions with the same idempotency_key
        WHEN  the second one is flushed
        THEN  IntegrityError is raised (UNIQUE violation)
        """
        idem_key = "550e8400-e29b-41d4-a716-446655440000"

        tx1 = Transaction(
            user_id=repo_user.id,
            category_id=repo_category.id,
            amount=Decimal("100.00"),
            entry_type="expense",
            idempotency_key=idem_key,
            executed_at=datetime.now(UTC),
        )
        db_session.add(tx1)
        await db_session.flush()

        tx2 = Transaction(
            user_id=repo_user.id,
            category_id=repo_category.id,
            amount=Decimal("200.00"),
            entry_type="expense",
            idempotency_key=idem_key,  # DUPLICATE!
            executed_at=datetime.now(UTC),
        )
        db_session.add(tx2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

    async def test_null_idempotency_keys_are_allowed(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """
        GIVEN two transactions with idempotency_key=None
        WHEN  both are inserted
        THEN  no error — NULL != NULL in SQL
        """
        for i in range(2):
            tx = Transaction(
                user_id=repo_user.id,
                category_id=repo_category.id,
                amount=Decimal(f"{100 + i}.00"),
                entry_type="expense",
                idempotency_key=None,
                executed_at=datetime.now(UTC),
            )
            db_session.add(tx)

        await db_session.flush()
        # Both should exist
        result = await db_session.execute(
            select(Transaction).where(Transaction.user_id == repo_user.id)
        )
        assert len(result.scalars().all()) == 2


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST: User UNIQUE email
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestUserConstraints:
    """Verify DB-level constraints on the users table."""

    async def test_duplicate_email_raises_error(
        self, db_session: AsyncSession, repo_user: User
    ) -> None:
        """UNIQUE constraint on email prevents duplicate accounts."""
        duplicate = User(
            email=repo_user.email,  # same email!
            hashed_password="$argon2id$another_hash",
        )
        db_session.add(duplicate)

        with pytest.raises(IntegrityError):
            await db_session.flush()

    async def test_duplicate_telegram_chat_id_raises_error(
        self, db_session: AsyncSession
    ) -> None:
        """UNIQUE constraint on telegram_chat_id prevents multi-bind."""
        user1 = User(
            email="tg-user-1@test.com",
            hashed_password="$argon2id$hash1",
            telegram_chat_id=123456789,
        )
        user2 = User(
            email="tg-user-2@test.com",
            hashed_password="$argon2id$hash2",
            telegram_chat_id=123456789,  # same chat_id!
        )
        db_session.add(user1)
        await db_session.flush()
        db_session.add(user2)

        with pytest.raises(IntegrityError):
            await db_session.flush()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST: Budget UNIQUE (user_id, category_id, month, year)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestBudgetConstraints:
    """Verify DB-level UNIQUE constraint on budget envelopes."""

    async def test_duplicate_budget_same_month_raises_error(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """One budget per category per month per user."""
        budget1 = Budget(
            user_id=repo_user.id,
            category_id=repo_category.id,
            month=6,
            year=2026,
            amount_limit=Decimal("30000.00"),
        )
        budget2 = Budget(
            user_id=repo_user.id,
            category_id=repo_category.id,
            month=6,
            year=2026,  # same month/year!
            amount_limit=Decimal("50000.00"),
        )
        db_session.add(budget1)
        await db_session.flush()
        db_session.add(budget2)

        with pytest.raises(IntegrityError):
            await db_session.flush()

    async def test_different_months_allowed(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """Different months → no conflict."""
        for month in [6, 7, 8]:
            budget = Budget(
                user_id=repo_user.id,
                category_id=repo_category.id,
                month=month,
                year=2026,
                amount_limit=Decimal("25000.00"),
            )
            db_session.add(budget)

        await db_session.flush()
        result = await db_session.execute(
            select(Budget).where(Budget.user_id == repo_user.id)
        )
        assert len(result.scalars().all()) == 3


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST: CASCADE deletes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCascadeDeletes:
    """Verify ON DELETE CASCADE behavior."""

    async def test_deleting_user_cascades_to_transactions(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """Deleting a user should cascade-delete their transactions."""
        tx = Transaction(
            user_id=repo_user.id,
            category_id=repo_category.id,
            amount=Decimal("500.00"),
            entry_type="expense",
            executed_at=datetime.now(UTC),
        )
        db_session.add(tx)
        await db_session.flush()

        # Delete the user
        await db_session.delete(repo_user)
        await db_session.flush()

        # Transactions should be gone
        result = await db_session.execute(
            select(Transaction).where(Transaction.user_id == repo_user.id)
        )
        assert len(result.scalars().all()) == 0

    async def test_deleting_category_cascades_to_transactions(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """Deleting a category should cascade-delete its transactions."""
        tx = Transaction(
            user_id=repo_user.id,
            category_id=repo_category.id,
            amount=Decimal("300.00"),
            entry_type="expense",
            executed_at=datetime.now(UTC),
        )
        db_session.add(tx)
        await db_session.flush()

        await db_session.delete(repo_category)
        await db_session.flush()

        result = await db_session.execute(
            select(Transaction).where(Transaction.category_id == repo_category.id)
        )
        assert len(result.scalars().all()) == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST: NUMERIC(12,2) precision
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestNumericPrecision:
    """Verify that NUMERIC(12,2) preserves monetary precision."""

    async def test_decimal_precision_preserved(
        self, db_session: AsyncSession, repo_user: User, repo_category: Category
    ) -> None:
        """Inserting 1234.56 and reading back should give exactly 1234.56."""
        tx = Transaction(
            user_id=repo_user.id,
            category_id=repo_category.id,
            amount=Decimal("1234.56"),
            entry_type="expense",
            executed_at=datetime.now(UTC),
        )
        db_session.add(tx)
        await db_session.flush()

        result = await db_session.execute(
            select(Transaction).where(Transaction.id == tx.id)
        )
        loaded = result.scalar_one()
        assert loaded.amount == Decimal("1234.56")

    async def test_monthly_income_precision(
        self, db_session: AsyncSession, repo_user: User
    ) -> None:
        """User monthly_income NUMERIC(12,2) precision."""
        repo_user.monthly_income = Decimal("150000.75")
        await db_session.flush()

        result = await db_session.execute(
            select(User).where(User.id == repo_user.id)
        )
        loaded = result.scalar_one()
        assert loaded.monthly_income == Decimal("150000.75")
