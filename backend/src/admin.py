"""
SQLAdmin Back-office — панель управления финансовым доменом в браузере.

Монтируется в /admin. Аутентификация по сессии для единственного админа на
базе itsdangerous (secret_key переиспользуется из настроек JWT). Вход
отключён, пока не задан ET_ADMIN_PASSWORD — пустой пароль отклоняет любую
попытку входа.
"""

from __future__ import annotations

import secrets

from fastapi import FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request

from src.config import settings
from src.database import engine
from src.domain.models import (
    BankOffer,
    Budget,
    Category,
    Insight,
    MerchantRule,
    Transaction,
    User,
)
from src.infrastructure.redis_client import get_redis

# Брутфорс-защита формы входа: не больше N попыток с одного IP в окне.
_LOGIN_MAX_ATTEMPTS = 5
_LOGIN_WINDOW_SECONDS = 60


class AdminAuth(AuthenticationBackend):
    """Вход по сессии для единственного админа против ET_ADMIN_USERNAME / ET_ADMIN_PASSWORD."""

    async def login(self, request: Request) -> bool:
        # Rate-limit брутфорса пароля. SQLAdmin login — это не FastAPI-route,
        # декоратор @limiter.limit здесь не работает, поэтому считаем попытки
        # вручную в Redis (INCR + EXPIRE на первую попытку в окне). Fail-open:
        # если Redis недоступен — не блокируем вход, чтобы не запереть админа.
        client_ip = request.client.host if request.client else "unknown"
        attempts_key = f"admin_login_attempts:{client_ip}"
        redis = None
        try:
            redis = await get_redis()
            attempts = await redis.incr(attempts_key)
            if attempts == 1:
                await redis.expire(attempts_key, _LOGIN_WINDOW_SECONDS)
            if attempts > _LOGIN_MAX_ATTEMPTS:
                return False  # слишком много попыток — отклоняем, не проверяя пароль
        except Exception:
            redis = None  # Redis недоступен — деградируем без rate-limit

        form = await request.form()
        username = str(form.get("username", ""))
        password = str(form.get("password", ""))
        if not settings.admin_password:
            return False  # админка отключена, пока не задан пароль
        ok_user = secrets.compare_digest(username, settings.admin_username)
        ok_pass = secrets.compare_digest(password, settings.admin_password)
        if ok_user and ok_pass:
            if redis is not None:
                await redis.delete(attempts_key)  # успешный вход обнуляет счётчик
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
        User.role,
        User.monthly_income,
        User.telegram_chat_id,
        User.created_at,
    ]
    column_searchable_list = [User.email, User.full_name]
    column_sortable_list = [User.id, User.created_at]
    # Detail-view только по скалярным полям: коллекции теперь lazy="raise_on_sql",
    # и их авто-рендер в detail дёрнул бы ленивую загрузку → ошибка. Связи смотрим
    # в своих разделах админки (Categories/Budgets/Transactions).
    column_details_list = [
        User.id,
        User.email,
        User.full_name,
        User.role,
        User.monthly_income,
        User.phone,
        User.telegram_chat_id,
        User.created_at,
    ]
    # Никогда не показывать хеш пароля в формах редактирования/создания.
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


class BankOfferAdmin(ModelView, model=BankOffer):
    name = "Bank Offer"
    name_plural = "Bank Offers"
    icon = "fa-solid fa-percent"
    column_list = [
        BankOffer.id,
        BankOffer.name,
        BankOffer.rate,
        BankOffer.is_active,
        BankOffer.partner_url,
        BankOffer.clicks,
        BankOffer.sort_order,
    ]
    column_sortable_list = [BankOffer.id, BankOffer.rate, BankOffer.clicks, BankOffer.sort_order]
    form_excluded_columns = [BankOffer.clicks, BankOffer.created_at]  # счётчик управляется API


class InsightAdmin(ModelView, model=Insight):
    name = "Insight"
    name_plural = "Insights"
    icon = "fa-solid fa-brain"
    column_list = [
        Insight.id,
        Insight.user_id,
        Insight.period_start,
        Insight.period_end,
        Insight.model_used,
        Insight.created_at,
    ]
    column_sortable_list = [Insight.id, Insight.created_at]
    can_create = False  # инсайты создаются только пайплайном ARQ
    can_edit = False


class MerchantRuleAdmin(ModelView, model=MerchantRule):
    name = "Merchant Rule"
    name_plural = "Merchant Rules"
    icon = "fa-solid fa-shop"
    column_list = [
        MerchantRule.id,
        MerchantRule.keyword,
        MerchantRule.category,
        MerchantRule.is_active,
        MerchantRule.created_at,
    ]
    column_searchable_list = [MerchantRule.keyword, MerchantRule.category]
    form_excluded_columns = [MerchantRule.created_at]


def setup_admin(app: FastAPI) -> None:
    """Смонтировать панель SQLAdmin и зарегистрировать все view моделей."""
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
    admin.add_view(BankOfferAdmin)
    admin.add_view(InsightAdmin)
    admin.add_view(MerchantRuleAdmin)
