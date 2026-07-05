"""
tests/integration/test_import_export.py — Import/Export Service Integration Tests.

Tests CSV/Excel import → DB pipeline and CSV export roundtrip.
Runs against real PostgreSQL via db_session fixture (savepoint-isolated).

Architecture:
  CSV bytes ─→ import_transactions() ─→ PostgreSQL ─→ export_transactions_csv() ─→ CSV bytes
                     ↓                        ↓
              category auto-creation     idempotency dedup
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from io import BytesIO

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, Transaction, User
from src.services.import_export_service import (
    ImportResult,
    export_transactions_csv,
    import_transactions,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Fixtures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest.fixture
async def import_user(db_session: AsyncSession) -> User:
    """User with one expense category for import tests."""
    user = User(
        email="import-test@citrine.dev",
        hashed_password="$argon2id$fake_hash",
    )
    db_session.add(user)
    await db_session.flush()

    cat = Category(
        user_id=user.id,
        name="Продукты",
        type=CategoryType.expense,
    )
    db_session.add(cat)
    await db_session.flush()
    return user


def _make_csv(
    rows: list[list[str]],
    header: str = "Date,Amount,Category,Comment",
) -> bytes:
    """Build a UTF-8 BOM CSV from rows."""
    lines = [header] + [",".join(r) for r in rows]
    content = "\n".join(lines)
    return b"\xef\xbb\xbf" + content.encode("utf-8")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# import_transactions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestImportTransactions:
    """CSV → DB import pipeline."""

    async def test_basic_import_creates_transactions(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        csv_bytes = _make_csv(
            [
                ["2026-06-01", "1500.00", "Продукты", "Пятёрочка"],
                ["2026-06-02", "2300.50", "Продукты", "Перекрёсток"],
            ]
        )
        result = await import_transactions(db_session, import_user.id, csv_bytes, "test.csv")

        assert isinstance(result, ImportResult)
        assert result.created == 2
        assert result.skipped == 0
        assert len(result.errors) == 0

    async def test_auto_creates_new_category(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        """Category not in DB should be auto-created."""
        csv_bytes = _make_csv(
            [
                ["2026-06-15", "5000.00", "Развлечения", "Кино"],
            ]
        )
        result = await import_transactions(db_session, import_user.id, csv_bytes, "test.csv")
        assert result.created == 1

        # Check that 'Развлечения' category was created
        cat_result = await db_session.execute(
            select(Category).where(
                Category.user_id == import_user.id,
                Category.name == "Развлечения",
            )
        )
        cat = cat_result.scalar_one_or_none()
        assert cat is not None

    async def test_idempotency_prevents_duplicates(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        """Importing the same CSV twice should not create duplicates."""
        csv_bytes = _make_csv(
            [
                ["2026-06-01", "1500.00", "Продукты", "Пятёрочка"],
            ]
        )

        result1 = await import_transactions(db_session, import_user.id, csv_bytes, "test.csv")
        assert result1.created == 1

        result2 = await import_transactions(db_session, import_user.id, csv_bytes, "test.csv")
        assert result2.created == 0
        assert result2.skipped == 1

    async def test_empty_csv_returns_error(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        csv_bytes = b"\xef\xbb\xbfDate,Amount\n"
        result = await import_transactions(db_session, import_user.id, csv_bytes, "empty.csv")
        assert len(result.errors) > 0

    async def test_missing_required_column_returns_error(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        csv_bytes = _make_csv(
            [["SomeValue", "Another"]],
            header="Foo,Bar",
        )
        result = await import_transactions(db_session, import_user.id, csv_bytes, "bad.csv")
        assert len(result.errors) > 0
        assert result.created == 0

    async def test_unsupported_format_returns_error(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        result = await import_transactions(db_session, import_user.id, b"random", "test.json")
        assert len(result.errors) > 0
        assert "формат" in result.errors[0].lower() or "json" in result.errors[0].lower()

    async def test_russian_column_names(self, db_session: AsyncSession, import_user: User) -> None:
        """Russian column names (Дата, Сумма) should be recognized."""
        csv_bytes = _make_csv(
            [["2026-06-01", "999.99", "Продукты", "Тест"]],
            header="Дата,Сумма,Категория,Комментарий",
        )
        result = await import_transactions(db_session, import_user.id, csv_bytes, "ru.csv")
        assert result.created == 1

    async def test_zero_amount_skipped(self, db_session: AsyncSession, import_user: User) -> None:
        """Rows with zero amount should be skipped."""
        csv_bytes = _make_csv(
            [
                ["2026-06-01", "0", "Продукты", "Нулевой"],
            ]
        )
        result = await import_transactions(db_session, import_user.id, csv_bytes, "zero.csv")
        assert result.created == 0
        assert result.skipped == 1


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# export_transactions_csv
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestExportTransactionsCsv:
    """DB → CSV export pipeline."""

    async def test_export_empty_user(self, db_session: AsyncSession, import_user: User) -> None:
        """User with no transactions should export header-only CSV."""
        buffer = await export_transactions_csv(db_session, import_user.id)
        content = buffer.read().decode("utf-8-sig")
        lines = content.strip().split("\n")
        assert len(lines) == 1  # header only
        assert "Date" in lines[0]

    async def test_export_contains_transaction_data(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        """Exported CSV should contain the transaction data."""
        # Get user's category
        cat_result = await db_session.execute(
            select(Category).where(
                Category.user_id == import_user.id,
                Category.name == "Продукты",
            )
        )
        cat = cat_result.scalar_one()

        # Insert a transaction
        tx = Transaction(
            user_id=import_user.id,
            category_id=cat.id,
            amount=Decimal("1234.56"),
            currency="RUB",
            is_recurring=False,
            entry_type="manual",
            comment="Тестовая покупка",
            executed_at=datetime(2026, 6, 15, 12, 0, 0, tzinfo=UTC),
        )
        db_session.add(tx)
        await db_session.flush()

        buffer = await export_transactions_csv(db_session, import_user.id)
        content = buffer.read().decode("utf-8-sig")
        lines = content.strip().split("\n")

        assert len(lines) == 2  # header + 1 data row
        assert "1234.56" in lines[1]
        assert "Продукты" in lines[1]
        assert "Тестовая покупка" in lines[1]

    async def test_export_returns_bytesio(
        self, db_session: AsyncSession, import_user: User
    ) -> None:
        buffer = await export_transactions_csv(db_session, import_user.id)
        assert isinstance(buffer, BytesIO)
        # Should start with UTF-8 BOM
        buffer.seek(0)
        assert buffer.read(3) == b"\xef\xbb\xbf"
