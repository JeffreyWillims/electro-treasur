"""
tests/integration/test_api_full.py — Full CRUD API Integration Tests.

Tests the complete HTTP pipeline for all major endpoints:
  POST/GET/PATCH/DELETE /v1/transactions/
  PUT/DELETE /v1/budgets/
  GET/POST/PATCH/DELETE /v1/users/categories
  POST /v1/auth/register + POST /v1/auth/login
  GET /v1/health

Each test hits the real FastAPI app via httpx + AsyncClient,
with DB dependency overridden to use savepoint-isolated PostgreSQL.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, User
from tests.factories.transactions import TransactionCreateFactory


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Fixtures
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@pytest.fixture
async def api_category(db_session: AsyncSession, test_user: User) -> Category:
    """Expense category for API tests."""
    cat = Category(
        user_id=test_user.id,
        name="API Test Category",
        type=CategoryType.expense,
        icon="#FF7A00",
    )
    db_session.add(cat)
    await db_session.flush()
    return cat


@pytest.fixture
async def api_income_cat(db_session: AsyncSession, test_user: User) -> Category:
    """Income category for budget and income tests."""
    cat = Category(
        user_id=test_user.id,
        name="API Salary",
        type=CategoryType.income,
        icon="#10B981",
    )
    db_session.add(cat)
    await db_session.flush()
    return cat


@pytest.fixture
async def created_tx_id(
    async_client: AsyncClient,
    auth_headers: dict[str, str],
    api_category: Category,
) -> int:
    """Create a transaction and return its ID for PATCH/DELETE tests."""
    payload = TransactionCreateFactory.build_json(
        category_id=api_category.id,
        amount="777.77",
    )
    resp = await async_client.post(
        "/v1/transactions/", json=payload, headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Healthcheck
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestHealthcheck:
    """GET /v1/health — liveness probe."""

    async def test_health_returns_200(self, async_client: AsyncClient) -> None:
        resp = await async_client.get("/v1/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Transaction CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestTransactionGet:
    """GET /v1/transactions/ — list with filtering."""

    async def test_empty_list(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        resp = await async_client.get(
            "/v1/transactions/", headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []

    async def test_list_after_create(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        created_tx_id: int,
    ) -> None:
        resp = await async_client.get(
            "/v1/transactions/", headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        tx_ids = [item["id"] for item in body["items"]]
        assert created_tx_id in tx_ids

    async def test_pagination_limit(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        """Create 3 transactions, request limit=2."""
        for i in range(3):
            payload = TransactionCreateFactory.build_json(
                category_id=api_category.id, amount=str(100 + i),
            )
            await async_client.post(
                "/v1/transactions/", json=payload, headers=auth_headers,
            )

        resp = await async_client.get(
            "/v1/transactions/?limit=2", headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["items"]) == 2
        assert body["total"] == 3

    async def test_filter_by_min_amount(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        """Filter by min_amount should only return matching transactions."""
        for amt in ["50.00", "150.00", "500.00"]:
            payload = TransactionCreateFactory.build_json(
                category_id=api_category.id, amount=amt,
            )
            await async_client.post(
                "/v1/transactions/", json=payload, headers=auth_headers,
            )

        resp = await async_client.get(
            "/v1/transactions/?min_amount=100", headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        for item in body["items"]:
            assert Decimal(str(item["amount"])) >= Decimal("100")

    async def test_unauthenticated_returns_401(
        self, async_client: AsyncClient,
    ) -> None:
        resp = await async_client.get("/v1/transactions/")
        assert resp.status_code == 401


class TestTransactionPatch:
    """PATCH /v1/transactions/{id} — partial update."""

    async def test_update_amount(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        created_tx_id: int,
    ) -> None:
        resp = await async_client.patch(
            f"/v1/transactions/{created_tx_id}",
            json={"amount": "999.99"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert Decimal(str(resp.json()["amount"])) == Decimal("999.99")

    async def test_update_comment(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        created_tx_id: int,
    ) -> None:
        resp = await async_client.patch(
            f"/v1/transactions/{created_tx_id}",
            json={"comment": "Обновлённый комментарий"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["comment"] == "Обновлённый комментарий"

    async def test_update_nonexistent_returns_404(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.patch(
            "/v1/transactions/999999",
            json={"amount": "1.00"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestTransactionDelete:
    """DELETE /v1/transactions/{id}."""

    async def test_delete_returns_204(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        created_tx_id: int,
    ) -> None:
        resp = await async_client.delete(
            f"/v1/transactions/{created_tx_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent_returns_404(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.delete(
            "/v1/transactions/999999",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_double_delete_returns_404(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        created_tx_id: int,
    ) -> None:
        """Delete twice → second should 404."""
        await async_client.delete(
            f"/v1/transactions/{created_tx_id}", headers=auth_headers,
        )
        resp = await async_client.delete(
            f"/v1/transactions/{created_tx_id}", headers=auth_headers,
        )
        assert resp.status_code == 404


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Budget CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestBudgetEndpoints:
    """PUT/DELETE /v1/budgets/."""

    async def test_upsert_budget(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        payload = {
            "category_id": api_category.id,
            "amount_limit": "30000.00",
            "month": 7,
            "year": 2026,
        }
        resp = await async_client.put(
            "/v1/budgets/", json=payload, headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"
        assert resp.json()["amount_limit"] == "30000.00"

    async def test_upsert_updates_existing(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        """PUT same month/category twice should update the amount."""
        base = {
            "category_id": api_category.id,
            "month": 8,
            "year": 2026,
        }
        await async_client.put(
            "/v1/budgets/",
            json={**base, "amount_limit": "20000.00"},
            headers=auth_headers,
        )
        resp = await async_client.put(
            "/v1/budgets/",
            json={**base, "amount_limit": "35000.00"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["amount_limit"] == "35000.00"

    async def test_delete_budget(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        # Create first
        await async_client.put(
            "/v1/budgets/",
            json={
                "category_id": api_category.id,
                "amount_limit": "10000.00",
                "month": 9,
                "year": 2026,
            },
            headers=auth_headers,
        )
        # Delete
        resp = await async_client.delete(
            f"/v1/budgets/{api_category.id}?month=9&year=2026",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_delete_nonexistent_budget_404(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.delete(
            "/v1/budgets/999999?month=1&year=2026",
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# User Profile & Categories
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestUserProfile:
    """GET/PATCH /v1/users/me."""

    async def test_get_me(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        test_user: User,
    ) -> None:
        resp = await async_client.get("/v1/users/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == test_user.email

    async def test_patch_me(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.patch(
            "/v1/users/me",
            json={"full_name": "Обновлённое Имя", "phone": "+7999111222"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Обновлённое Имя"

    async def test_get_me_unauthenticated(
        self, async_client: AsyncClient,
    ) -> None:
        resp = await async_client.get("/v1/users/me")
        assert resp.status_code == 401


class TestUserCategories:
    """POST/GET/PATCH/DELETE /v1/users/categories."""

    async def test_get_categories(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        resp = await async_client.get(
            "/v1/users/categories", headers=auth_headers,
        )
        assert resp.status_code == 200
        names = [c["name"] for c in resp.json()]
        assert "API Test Category" in names

    async def test_create_category(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.post(
            "/v1/users/categories",
            json={"name": "Путешествия", "type": "expense", "icon": "#06B6D4"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Путешествия"

    async def test_patch_category(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        resp = await async_client.patch(
            f"/v1/users/categories/{api_category.id}",
            json={"name": "Переименованная"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Переименованная"

    async def test_patch_nonexistent_category_404(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.patch(
            "/v1/users/categories/999999",
            json={"name": "Ghost"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_delete_category(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        resp = await async_client.delete(
            f"/v1/users/categories/{api_category.id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    async def test_transaction_count_endpoint(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
        api_category: Category,
    ) -> None:
        resp = await async_client.get(
            f"/v1/users/categories/{api_category.id}/transaction-count",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["transaction_count"] == 0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Auth: Register + Login
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestAuthFlow:
    """POST /v1/auth/register + POST /v1/auth/login."""

    async def test_register_new_user(
        self, async_client: AsyncClient,
    ) -> None:
        resp = await async_client.post(
            "/v1/auth/register",
            json={
                "email": "fresh-register@citrine.dev",
                "password": "StrongPass99!",
                "full_name": "Fresh User",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["email"] == "fresh-register@citrine.dev"
        assert "id" in body

    async def test_register_duplicate_email_400(
        self, async_client: AsyncClient, test_user: User,
    ) -> None:
        resp = await async_client.post(
            "/v1/auth/register",
            json={
                "email": test_user.email,
                "password": "AnyPassword123!",
            },
        )
        assert resp.status_code == 400

    async def test_login_success(
        self, async_client: AsyncClient, test_user: User,
    ) -> None:
        resp = await async_client.post(
            "/v1/auth/login",
            data={
                "username": test_user.email,
                "password": "TestPass123!",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    async def test_login_wrong_password_401(
        self, async_client: AsyncClient, test_user: User,
    ) -> None:
        resp = await async_client.post(
            "/v1/auth/login",
            data={
                "username": test_user.email,
                "password": "WrongPassword!",
            },
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user_401(
        self, async_client: AsyncClient,
    ) -> None:
        resp = await async_client.post(
            "/v1/auth/login",
            data={
                "username": "nobody@void.space",
                "password": "AnyPassword123!",
            },
        )
        assert resp.status_code == 401


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Export via API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class TestExportEndpoint:
    """GET /v1/transactions/export."""

    async def test_export_returns_csv(
        self, async_client: AsyncClient, auth_headers: dict[str, str],
    ) -> None:
        resp = await async_client.get(
            "/v1/transactions/export", headers=auth_headers,
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        assert "citrine_vault" in resp.headers.get("content-disposition", "")
