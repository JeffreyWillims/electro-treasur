"""
SQLAdmin Back-office — browser-based control panel for the financial domain.

Mounted at /admin. Single-admin session auth backed by itsdangerous
(secret_key reused from JWT settings). Login is disabled until
ET_ADMIN_PASSWORD is set — empty password rejects every attempt.
"""

from __future__ import annotations

import secrets

from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from src.config import settings
from src.database import engine
from src.domain.models import Budget, Category, Transaction, User


class AdminAuth(AuthenticationBackend):
    """Single-admin session login against ET_ADMIN_USERNAME / ET_ADMIN_PASSWORD."""

    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = str(form.get("username", ""))
        password = str(form.get("password", ""))
        if not settings.admin_password:
            return False  # admin disabled until password configured
        ok_user = secrets.compare_digest(username, settings.admin_username)
        ok_pass = secrets.compare_digest(password, settings.admin_password)
        if ok_user and ok_pass:
            request.session.update({"admin": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return bool(request.session.get("admin"))


class UserAdmin(ModelView, model=User):
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-user"
    column_list = [
        User.id,
        User.email,
        User.full_name,
        User.monthly_income,
        User.telegram_chat_id,
        User.created_at,
    ]
    column_searchable_list = [User.email, User.full_name]
    column_sortable_list = [User.id, User.created_at]
    # Never expose the password hash in edit/create forms.
    form_excluded_columns = [
        User.hashed_password,
        User.created_at,
        User.categories,
        User.budgets,
        User.transactions,
    ]


class CategoryAdmin(ModelView, model=Category):
    name = "Category"
    name_plural = "Categories"
    icon = "fa-solid fa-tag"
    column_list = [Category.id, Category.user_id, Category.name, Category.type, Category.parent_id]
    column_searchable_list = [Category.name]
    column_sortable_list = [Category.id]


class BudgetAdmin(ModelView, model=Budget):
    name = "Budget"
    name_plural = "Budgets"
    icon = "fa-solid fa-money-bill"
    column_list = [
        Budget.id,
        Budget.user_id,
        Budget.category_id,
        Budget.month,
        Budget.year,
        Budget.amount_limit,
    ]
    column_sortable_list = [Budget.id, Budget.year, Budget.month]


class TransactionAdmin(ModelView, model=Transaction):
    name = "Transaction"
    name_plural = "Transactions"
    icon = "fa-solid fa-receipt"
    column_list = [
        Transaction.id,
        Transaction.user_id,
        Transaction.category_id,
        Transaction.amount,
        Transaction.currency,
        Transaction.entry_type,
        Transaction.executed_at,
    ]
    column_searchable_list = [Transaction.comment]
    column_sortable_list = [Transaction.id, Transaction.amount, Transaction.executed_at]


def setup_admin(app: FastAPI) -> None:
    """Mount the SQLAdmin panel and register all model views."""
    authentication_backend = AdminAuth(secret_key=settings.secret_key)
    admin = Admin(
        app,
        engine,
        authentication_backend=authentication_backend,
        title="Citrine Vault Admin",
    )
    admin.add_view(UserAdmin)
    admin.add_view(CategoryAdmin)
    admin.add_view(BudgetAdmin)
    admin.add_view(TransactionAdmin)
