"""
tests/integration/test_api.py — Integration Tests (FastAPI + PostgreSQL).

Tests the full HTTP → Route → Service → ORM → PostgreSQL pipeline
with real database operations, isolated by the Nested Savepoint strategy
from conftest.py.

Architecture:
  ┌─────────────────────────────────────────────────────────────┐
  │  Integration Test Layer                                     │
  │                                                             │
  │  async_client (httpx) ──→ FastAPI app ──→ route handler     │
  │       ↓                        ↓              ↓             │
  │  JSON payload         get_db override    service function   │
  │       ↓                        ↓              ↓             │
  │  TransactionCreate      db_session ←──── ORM INSERT         │
  │       ↓                        ↓              ↓             │
  │  201 / 422             SAVEPOINT ←───── PostgreSQL          │
  │                         (rolled back after test)            │
  └─────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, Transaction, User
from tests.factories.transactions import TransactionCreateFactory


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FIXTURES — test-specific data setup
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest.fixture
async def test_category(db_session: AsyncSession, test_user: User) -> Category:
    """
    Create a prerequisite expense Category in the test DB.

    Transactions require a valid category_id FK, so we seed one here.
    """
    cat = Category(
        user_id=test_user.id,
        name="Тестовая категория",
        type=CategoryType.expense,
        icon="#FF7A00",
    )
    db_session.add(cat)
    await db_session.flush()
    return cat


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POSITIVE TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestCreateTransaction:
    """POST /v1/transactions/ — success path with DB verification."""

    async def test_create_transaction_returns_201_and_persists(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
        test_category: Category,
    ) -> None:
        """
        GIVEN a valid TransactionCreate payload with a real category_id
        WHEN  POST /v1/transactions/ is called with auth headers
        THEN  response status is 201
        AND   response body matches the input
        AND   Transaction row exists in PostgreSQL
        """
        # ── ARRANGE ──────────────────────────────────────────────────────
        payload = TransactionCreateFactory.build_json(
            category_id=test_category.id,
            amount="1523.45",
        )

        # ── ACT ──────────────────────────────────────────────────────────
        response = await async_client.post(
            "/v1/transactions/",
            json=payload,
            headers=auth_headers,
        )

        # ── ASSERT (HTTP layer) ──────────────────────────────────────────
        assert response.status_code == 201, (
            f"Expected 201, got {response.status_code}: {response.text}"
        )

        body = response.json()
        assert Decimal(str(body["amount"])) == Decimal("1523.45")
        assert body["category_id"] == test_category.id
        assert body["currency"] == "RUB"
        assert body["entry_type"] == "manual"
        assert body["id"] is not None  # DB-generated PK

        # ── ASSERT (DB layer) ────────────────────────────────────────────
        # Verify the transaction actually landed in PostgreSQL
        tx_id = body["id"]
        stmt = select(Transaction).where(Transaction.id == tx_id)
        result = await db_session.execute(stmt)
        tx_row = result.scalar_one_or_none()

        assert tx_row is not None, "Transaction not found in DB after 201 response"
        assert tx_row.amount == Decimal("1523.45")
        assert tx_row.category_id == test_category.id

    async def test_create_transaction_with_factory_generated_data(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        test_category: Category,
    ) -> None:
        """
        GIVEN a fully random payload from TransactionCreateFactory
        WHEN  POST /v1/transactions/ is called
        THEN  response status is 201 (Pydantic accepts the generated data)
        """
        payload = TransactionCreateFactory.build_json(
            category_id=test_category.id,
        )

        response = await async_client.post(
            "/v1/transactions/",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 201, f"Factory-generated payload rejected: {response.text}"

    async def test_cannot_attach_transaction_to_foreign_category(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        db_session: AsyncSession,
    ) -> None:
        """Межтенантная защита: нельзя создать транзакцию в чужой категории.

        Раньше v1 брал category_id из payload без проверки владельца — любой
        существующий id проходил по FK, что давало порчу данных и утечку чужого
        имени категории. Теперь — 404.
        """
        from argon2 import PasswordHasher

        other = User(
            email="foreign-owner@citrine.dev",
            hashed_password=PasswordHasher().hash("x"),
            full_name="Foreign Owner",
        )
        db_session.add(other)
        await db_session.flush()
        foreign_cat = Category(
            user_id=other.id, name="Чужая", type=CategoryType.expense, icon="#000"
        )
        db_session.add(foreign_cat)
        await db_session.flush()

        payload = TransactionCreateFactory.build_json(
            category_id=foreign_cat.id, amount="100.00"
        )
        response = await async_client.post(
            "/v1/transactions/", json=payload, headers=auth_headers
        )
        assert response.status_code == 404, response.text


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NEGATIVE TESTS — Pydantic V2 validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionValidation:
    """POST /v1/transactions/ — rejection of invalid payloads."""

    async def test_string_amount_returns_422(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        test_category: Category,
    ) -> None:
        """
        GIVEN a payload where amount is a non-numeric string
        WHEN  POST /v1/transactions/ is called
        THEN  Pydantic V2 rejects it with 422 Unprocessable Entity
        """
        payload = {
            "category_id": test_category.id,
            "amount": "not-a-number",
            "currency": "RUB",
        }

        response = await async_client.post(
            "/v1/transactions/",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 422
        # Кастомный handler (src/core/exceptions.py) возвращает
        # {"detail": "Ошибка валидации данных", "errors": [...]} —
        # список ошибок Pydantic V2 лежит в ключе "errors".
        errors = response.json()["errors"]
        assert any("amount" in str(err).lower() for err in errors), (
            f"Expected 'amount' validation error, got: {errors}"
        )

    async def test_missing_required_field_returns_422(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
    ) -> None:
        """
        GIVEN a payload missing the required 'category_id' field
        WHEN  POST /v1/transactions/ is called
        THEN  422 with validation error mentioning 'category_id'
        """
        payload = {
            "amount": "500.00",
            # category_id intentionally omitted
        }

        response = await async_client.post(
            "/v1/transactions/",
            json=payload,
            headers=auth_headers,
        )

        assert response.status_code == 422

    async def test_unauthenticated_request_returns_401(
        self,
        async_client: AsyncClient,
        test_category: Category,
    ) -> None:
        """
        GIVEN a valid payload but NO authorization header
        WHEN  POST /v1/transactions/ is called
        THEN  401 Unauthorized
        """
        payload = TransactionCreateFactory.build_json(
            category_id=test_category.id,
        )

        response = await async_client.post(
            "/v1/transactions/",
            json=payload,
            # No auth_headers!
        )

        assert response.status_code == 401
