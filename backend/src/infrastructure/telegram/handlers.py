from __future__ import annotations

import logging
import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from aiogram import F, Router
from aiogram.filters import Command, CommandObject
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    Message,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)
from aiogram.types.web_app_info import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, Transaction, User
from src.services.dashboard_service import get_monthly_dashboard

logger = logging.getLogger(__name__)
router = Router()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _get_ru_month(date_obj: date) -> str:
    """Возвращает название месяца на русском языке."""
    months = [
        "",
        "Январь",
        "Февраль",
        "Март",
        "Апрель",
        "Май",
        "Июнь",
        "Июль",
        "Август",
        "Сентябрь",
        "Октябрь",
        "Ноябрь",
        "Декабрь",
    ]
    return f"{months[date_obj.month]} {date_obj.year}"


CATEGORY_TRANSLATIONS = {
    "Operations (Rent/Utility)": "🏠 Базовые расходы (ЖКХ/Аренда)",
    "Leisure (Lifestyle)": "☕️ Лайфстайл (Развлечения)",
    "Wellness (Health)": "❤️ Здоровье и Уход",
    "Propulsion (Income)": "🚀 Поступления (Доход)",
    "Growth (Investments)": "📈 Инвестиции и Рост",
    "Income": "💰 Доход",
}

# Магия финтеха: маппинг русских слов в системные конверты
CATEGORY_SYNONYMS = {
    "такси": "Operations (Rent/Utility)",
    "транспорт": "Operations (Rent/Utility)",
    "бензин": "Operations (Rent/Utility)",
    "жкх": "Operations (Rent/Utility)",
    "продукты": "Operations (Rent/Utility)",
    "еда": "Operations (Rent/Utility)",
    "кофе": "Leisure (Lifestyle)",
    "кафе": "Leisure (Lifestyle)",
    "ресторан": "Leisure (Lifestyle)",
    "кино": "Leisure (Lifestyle)",
    "развлечения": "Leisure (Lifestyle)",
    "одежда": "Leisure (Lifestyle)",
    "аптека": "Wellness (Health)",
    "врач": "Wellness (Health)",
    "здоровье": "Wellness (Health)",
    "зарплата": "Propulsion (Income)",
    "аванс": "Propulsion (Income)",
    "премия": "Propulsion (Income)",
    "доход": "Propulsion (Income)",
    "вклад": "Growth (Investments)",
    "акции": "Growth (Investments)",
    "крипта": "Growth (Investments)",
}


def _clean_cat_name(name: str) -> str:
    """Удаляет HEX-коды цветов из строки (например '#8B5CF6 стики' -> 'стики')."""
    if not name:
        return ""
    return re.sub(r"#[0-9a-fA-F]{3,6}\s*", "", name).strip()


def _fix_layout(text: str) -> str:
    """Переводит английскую раскладку в русскую (например: 'ghjlerns' -> 'продукты')."""
    en = "qwertyuiop[]asdfghjkl;'zxcvbnm,./"
    ru = "йцукенгшщзхъфывапролджэячсмитьбю."
    tr = str.maketrans(en, ru)
    return text.translate(tr)


def _loc_category(cat_name: str) -> str:
    """Переводит английские системные категории на русский (с очисткой HEX)."""
    clean_name = _clean_cat_name(cat_name)
    if clean_name in CATEGORY_TRANSLATIONS:
        return CATEGORY_TRANSLATIONS[clean_name]
    for eng, ru in CATEGORY_TRANSLATIONS.items():
        if eng.lower() in clean_name.lower():
            return ru
    return clean_name


def _display_cat(name: str) -> str:
    """Форматирует название категории: использует встроенный эмодзи или добавляет дефолтную папку."""
    ru_name = _loc_category(name)
    clean_name = _clean_cat_name(name)

    if ru_name != name and ru_name != clean_name:
        return ru_name

    lower_name = clean_name.lower()
    if "базов" in lower_name or "жкх" in lower_name:
        return f"🏠 {clean_name}"
    if "лайфстайл" in lower_name or "развлеч" in lower_name:
        return f"☕️ {clean_name}"
    if "здоров" in lower_name:
        return f"❤️ {clean_name}"
    if "поступлен" in lower_name or "доход" in lower_name:
        return f"🚀 {clean_name}"
    if "инвест" in lower_name:
        return f"📈 {clean_name}"

    return f"📁 {clean_name}"


def _get_reply_menu() -> ReplyKeyboardMarkup:
    """Постоянное нижнее меню для быстрых действий."""
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="💎 Внести"),
                KeyboardButton(text="📊 Баланс"),
                KeyboardButton(text="📸 Скан чека"),
            ],
            [
                KeyboardButton(
                    text="🌌 Открыть Citrine Vault",
                    web_app=WebAppInfo(url="https://citrinevault.ru/"),
                )
            ],
        ],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Управление капиталом...",
    )


def _get_inline_dashboard() -> InlineKeyboardMarkup:
    """Премиальный Inline-виджет профиля."""
    builder = InlineKeyboardBuilder()
    builder.row(
        InlineKeyboardButton(text="➕ Внести", callback_data="menu_add"),
        InlineKeyboardButton(text="📊 Баланс", callback_data="menu_balance"),
    )
    builder.row(
        InlineKeyboardButton(text="📁 Конверты", callback_data="menu_categories"),
        InlineKeyboardButton(text="⚙️ Настройки", callback_data="menu_settings"),
    )
    builder.row(
        InlineKeyboardButton(
            text="🌌 Открыть Citrine Vault", web_app=WebAppInfo(url="https://citrinevault.ru/")
        )
    )
    return builder.as_markup()


def _get_current_month_range() -> tuple[date, date]:
    import calendar

    today = date.today()
    start = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    end = today.replace(day=last_day)
    return start, end


def _attr(obj: Any, key: str, default: Any = 0) -> Any:
    if hasattr(obj, key):
        return getattr(obj, key)
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


async def check_auth(event: Message | CallbackQuery, current_user: User | None) -> bool:
    if current_user is not None:
        return True

    text = (
        "⚠️ *Твой Telegram-аккаунт ещё не привязан к Citrine Vault.*\n\n"
        "1️⃣ Войди в личный кабинет на сайте.\n"
        "2️⃣ Перейди в *Профиль → Настройки → Telegram*.\n"
        "3️⃣ Сгенерируй код привязки.\n"
        "4️⃣ Отправь мне: `/link <код>` (например: `/link 482917`)"
    )
    if isinstance(event, Message):
        await event.answer(text, parse_mode="Markdown", reply_markup=ReplyKeyboardRemove())
    elif isinstance(event, CallbackQuery):
        if event.message is not None:
            await event.message.answer(
                text, parse_mode="Markdown", reply_markup=ReplyKeyboardRemove()
            )
        await event.answer()
    return False


# ─── Link Helper ──────────────────────────────────────────────────────────────


async def _attempt_link(
    message: Message, otp_code: str, session: AsyncSession, redis_client: Redis
) -> None:
    redis_key = f"telegram_otp:{otp_code}"
    user_id_bytes = await redis_client.get(redis_key)
    if user_id_bytes is None:
        await message.answer(
            "❌ Неверный или устаревший код привязки.", reply_markup=ReplyKeyboardRemove()
        )
        return
    user_id = int(user_id_bytes)
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        await message.answer("❌ Ошибка: пользователь не найден в базе.")
        return

    dup_result = await session.execute(
        select(User).where(User.telegram_chat_id == message.chat.id)
    )
    if dup_result.scalar_one_or_none() is not None:
        await message.answer(
            "⚠️ Этот Telegram уже привязан к другому аккаунту!", reply_markup=ReplyKeyboardRemove()
        )
        return

    user.telegram_chat_id = message.chat.id
    await session.commit()
    await redis_client.delete(redis_key)
    await message.answer("📲 Меню быстрых действий активировано", reply_markup=_get_reply_menu())
    await message.answer(
        f"🎉 Успешно! Telegram привязан к аккаунту *{user.email}*.",
        parse_mode="Markdown",
        reply_markup=_get_inline_dashboard(),
    )


# ─── /start & Base Navigation ─────────────────────────────────────────────────


@router.message(Command("start"))
async def cmd_start(
    message: Message,
    command: CommandObject,
    session: AsyncSession,
    current_user: User | None,
    redis_client: Redis,
) -> None:
    loading_msg = await message.answer("🔄", reply_markup=ReplyKeyboardRemove())
    await loading_msg.delete()

    if current_user is None and command.args and re.fullmatch(r"\d{6}", command.args.strip()):
        await _attempt_link(message, command.args.strip(), session, redis_client)
        return

    if current_user is not None:
        start, end = _get_current_month_range()
        dashboard = await get_monthly_dashboard(
            session, user_id=current_user.id, start_date=start, end_date=end
        )
        total = _attr(dashboard, "total_balance_all_time")
        expense = _attr(dashboard, "period_expense")
        text = (
            f"🌟 *Личный кабинет:* {current_user.email}\n\n"
            f"💰 *Текущий капитал:* {total:,.2f} ₽\n"
            f"📉 *Расходы за {_get_ru_month(start)}:* {expense:,.2f} ₽\n\n"
            f"Управляй капиталом через меню ниже или просто отправь чек 📸"
        )
        await message.answer("📲 Меню быстрых действий обновлено", reply_markup=_get_reply_menu())
        await message.answer(text, parse_mode="Markdown", reply_markup=_get_inline_dashboard())
    else:
        builder = InlineKeyboardBuilder()
        builder.row(
            InlineKeyboardButton(text="ℹ️ Что умеет V.I.A.?", callback_data="welcome_about")
        )
        builder.row(InlineKeyboardButton(text="🔐 Авторизация", callback_data="welcome_auth"))

        await message.answer(
            "👋 Добро пожаловать в премиальный Wealth Manager *Citrine Vault*!",
            parse_mode="Markdown",
            reply_markup=builder.as_markup(),
        )

@router.message(Command("link"))
async def cmd_link(
    message: Message,
    command: CommandObject,
    session: AsyncSession,
    current_user: User | None,
    redis_client: Redis,
) -> None:
    if current_user is not None:
        await message.answer("⚠️ Твой аккаунт уже привязан к Citrine Vault.", reply_markup=_get_reply_menu())
        return

    if not command.args or not re.fullmatch(r"\d{6}", command.args.strip()):
        await message.answer("❌ Формат команды: `/link <6-значный код>`\nСгенерируй код на сайте в Настройках.", parse_mode="Markdown")
        return

    await _attempt_link(message, command.args.strip(), session, redis_client)

@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "🧠 *V.I.A. Assistant на связи!*\n\n"
        "Просто используй меню внизу экрана или пиши мне обычным текстом:\n\n"
        "✅ `500 такси`\n"
        "✅ `150000 зарплата`\n"
        "✅ Отправь фото чека или скриншот из банка 📸\n\n"
        "Если меню пропало, нажми /start",
        parse_mode="Markdown",
        reply_markup=_get_reply_menu(),
    )


@router.message(Command("unlink"))
@router.message(F.text == "🚪 Отвязать аккаунт")
async def cmd_unlink(message: Message, session: AsyncSession, current_user: User | None) -> None:
    if current_user is None:
        await message.answer(
            "⚠️ Твой аккаунт и так не привязан к системе.", reply_markup=ReplyKeyboardRemove()
        )
        return

    current_user.telegram_chat_id = None
    await session.commit()
    await message.answer(
        "✅ Твой Telegram успешно отвязан от профиля Citrine Vault.\n\n"
        "Чтобы привязать новый аккаунт, сгенерируй код на сайте и отправь мне: `/link <код>`",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove(),
    )


# ─── Inline Menu Callbacks ────────────────────────────────────────────────────


@router.callback_query(F.data == "menu_balance")
async def cb_menu_balance(
    callback: CallbackQuery, session: AsyncSession, current_user: User | None
) -> None:
    await cmd_balance(callback.message, session, current_user)
    await callback.answer()


@router.callback_query(F.data == "menu_categories")
async def cb_menu_categories(
    callback: CallbackQuery, session: AsyncSession, current_user: User | None
) -> None:
    await cmd_categories(callback.message, session, current_user)
    await callback.answer()


@router.callback_query(F.data == "menu_add")
async def cb_menu_add(callback: CallbackQuery) -> None:
    await callback.message.answer(
        "✍️ Просто отправь мне сумму и категорию:\n"
        "`500 Кофе`\n"
        "`150000 Зарплата`\n\n"
        "Или отправь скриншот/фото чека для авто-анализа 📸",
        parse_mode="Markdown",
        reply_markup=_get_reply_menu(),
    )
    await callback.answer()


@router.callback_query(F.data == "menu_settings")
async def cb_menu_settings(callback: CallbackQuery) -> None:
    await callback.message.answer(
        "⚙️ *Настройки профиля*\n\n"
        "Для смены аккаунта отправь команду: `/unlink`\n"
        "После этого ты сможешь привязать новый код.",
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "welcome_about")
async def cb_welcome_about(callback: CallbackQuery) -> None:
    await callback.message.answer(
        "🧠 *V.I.A. (Value Insight Aggregator)*\n\n"
        "Я — твой личный ИИ-банкир.\n"
        "🔹 Читаю чеки и банковские выписки.\n"
        "🔹 Распределяю расходы из обычного текста.\n"
        "🔹 Даю доступ к Web App прямо внутри Telegram.\n\n"
        "Для начала работы привяжи аккаунт: `/link <код>`",
        parse_mode="Markdown",
    )
    await callback.answer()


@router.callback_query(F.data == "welcome_auth")
async def cb_welcome_auth(callback: CallbackQuery) -> None:
    await callback.message.answer(
        "🔐 *Синхронизация профиля*\n\n"
        "1️⃣ Войди в личный кабинет на сайте.\n"
        "2️⃣ Перейди в *Профиль → Telegram*.\n"
        "3️⃣ Скопируй код и введи: `/link 123456`",
        parse_mode="Markdown",
    )
    await callback.answer()


# ─── /balance & Menu Analytics ────────────────────────────────────────────────


@router.message(Command("balance"))
async def cmd_balance(message: Message, session: AsyncSession, current_user: User | None) -> None:
    if not await check_auth(message, current_user):
        return
    assert current_user is not None
    start, end = _get_current_month_range()
    dashboard = await get_monthly_dashboard(
        session, user_id=current_user.id, start_date=start, end_date=end
    )

    total = _attr(dashboard, "total_balance_all_time")
    income = _attr(dashboard, "period_income")
    expense = _attr(dashboard, "period_expense")

    await message.answer(
        f"📊 *Финансовый баланс за {_get_ru_month(start)}:*\n\n"
        f"💰 *Общий капитал:* {total:,.2f} ₽\n"
        f"📈 *Доходы за период:* {income:,.2f} ₽\n"
        f"📉 *Расходы за период:* {expense:,.2f} ₽",
        parse_mode="Markdown",
        reply_markup=_get_reply_menu(),
    )


@router.message(Command("categories"))
async def cmd_categories(
    message: Message, session: AsyncSession, current_user: User | None
) -> None:
    if not await check_auth(message, current_user):
        return
    assert current_user is not None
    start, end = _get_current_month_range()
    dashboard = await get_monthly_dashboard(
        session, user_id=current_user.id, start_date=start, end_date=end
    )

    rows = _attr(dashboard, "rows", default=[]) or []
    if not rows:
        await message.answer(
            "📁 В этом периоде еще нет активных конвертов.", reply_markup=_get_reply_menu()
        )
        return

    lines: list[str] = [f"📅 *Состояние конвертов за {_get_ru_month(start)}:*\n"]
    for row in rows:
        name = _attr(row, "category_name", "—")
        planned = _attr(row, "planned", Decimal("0"))
        fact = _attr(row, "fact", Decimal("0"))

        display_name = _display_cat(name)
        if planned > 0:
            pct = min(int((fact / planned) * 100), 200)
            bar_len = 10
            filled = min(int(round(bar_len * pct / 100)), bar_len)
            bar = "█" * filled + "░" * (bar_len - filled)
            warn = " 🔥 Превышение!" if fact > planned else ""
            lines.append(
                f"*{display_name}*\n`[{bar}]` {pct}% ({fact:,.0f} / {planned:,.0f} ₽){warn}\n"
            )
        else:
            lines.append(f"*{display_name}*: {fact:,.0f} ₽ _(Без лимита)_\n")

    await message.answer("\n".join(lines), parse_mode="Markdown", reply_markup=_get_reply_menu())


# ─── Transaction Writers & Pickers ────────────────────────────────────────────


async def _show_category_selection(message: Message, amount: Decimal, current_user: User) -> None:
    builder = InlineKeyboardBuilder()
    for cat in current_user.categories[:20]:
        builder.add(
            InlineKeyboardButton(
                text=_display_cat(cat.name),
                callback_data=f"cat_sel:{cat.id}:{amount}",
            )
        )
    builder.adjust(1)
    await message.answer(
        f"💸 Сумма *{amount:,.2f} ₽* зафиксирована.\n\n"
        f"В какой конверт направим эту транзакцию? 👇",
        reply_markup=builder.as_markup(),
        parse_mode="Markdown",
    )


@router.callback_query(F.data.startswith("cat_sel:"))
async def process_category_selection(
    callback_query: CallbackQuery, session: AsyncSession, current_user: User | None
) -> None:
    if not await check_auth(callback_query, current_user):
        return
    assert current_user is not None
    try:
        _, cat_id_str, amount_str = callback_query.data.split(":", maxsplit=2)
        category_id = int(cat_id_str)
        amount = Decimal(amount_str)
    except (ValueError, InvalidOperation):
        await callback_query.answer("❌ Некорректные данные кнопки.")
        return

    result = await session.execute(
        select(Category).where(Category.id == category_id, Category.user_id == current_user.id)
    )
    category = result.scalar_one_or_none()

    if category is not None and callback_query.message is not None:
        await _create_bot_transaction(
            session, callback_query.message, current_user.id, category, amount
        )
    await callback_query.answer()


async def _create_bot_transaction(
    session: AsyncSession,
    message: Message,
    user_id: int,
    category: Category,
    amount: Decimal,
    entry_type: str | None = None,
    comment: str = "Telegram Bot",
) -> None:
    # Автоопределение типа операции, если не передан жестко
    if not entry_type:
        is_income = (
            "income" in category.name.lower()
            or "доход" in category.name.lower()
            or "поступления" in category.name.lower()
        )
        entry_type = "income" if is_income else "expense"

    raw_key = f"tg_{message.chat.id}_{message.message_id}_{category.id}_{amount}"
    idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_URL, raw_key))

    dup_check = await session.execute(
        select(Transaction).where(Transaction.idempotency_key == idempotency_key)
    )
    if dup_check.scalar_one_or_none() is not None:
        return

    tx = Transaction(
        user_id=user_id,
        category_id=category.id,
        amount=amount,
        currency="RUB",
        is_recurring=False,
        entry_type=entry_type,
        comment=comment,
        executed_at=datetime.now(UTC),
        idempotency_key=idempotency_key,
    )
    session.add(tx)
    await session.commit()

    display_name = _display_cat(category.name)
    sign = "+" if entry_type == "income" else "-"

    text = f"✅ Транзакция на *{sign}{amount:,.2f} ₽* успешно учтена в категории *{display_name}*!"

    msg_text = message.text or ""
    # Если это было редактирование Inline сообщения (выбор категории)
    if "Учесть транзакцию" in msg_text or "Выбери категорию" in msg_text:
        await message.edit_text(text, parse_mode="Markdown")
        await message.answer("📲 Баланс обновлен", reply_markup=_get_reply_menu())
    else:
        # Принудительно возвращаем меню, чтобы оно не пропадало
        await message.answer(text, parse_mode="Markdown", reply_markup=_get_reply_menu())


# ============================================================================
# Photo / Document Upload (Ollama AI Vision)
# ============================================================================


@router.message(F.photo | F.document)
async def handle_receipt_upload(
    message: Message, session: AsyncSession, current_user: User | None
) -> None:
    if not await check_auth(message, current_user):
        return
    assert current_user is not None

    file_type = "фотографию чека" if message.photo else "банковскую выписку"

    processing_msg = await message.answer(
        f"📸 Получил {file_type}. Передаю в Citrine V.I.A. для анализа...\n"
        f"⏳ Пожалуйста, подожди пару секунд.",
        parse_mode="Markdown",
    )

    # ─── 1. Определяем file_id и file_name ──────────────────────────
    if message.photo:
        file_id = message.photo[-1].file_id
        file_name = "receipt.jpg"
    elif message.document:
        file_id = message.document.file_id
        file_name = message.document.file_name or "document.pdf"
    else:
        await processing_msg.edit_text("❌ Не удалось определить файл.")
        return

    # ─── 2. ИСПРАВЛЕННЫЙ ИМПОРТ И ВЫЗОВ (Surgical Change) ───────────
    from src.services.ai_vision_service import analyze_document_universal

    ai_results = await analyze_document_universal(
        bot=message.bot,
        file_id=file_id,
        file_name=file_name,
    )

    if not ai_results:
        await processing_msg.edit_text(
            "⚠️ *ИИ не смог распознать чек или выписку.*\n\n"
            "Попробуй отправить более чёткое фото или внеси сумму вручную: `500 кофе`",
            parse_mode="Markdown",
        )
        await message.answer("📲 Баланс обновлен", reply_markup=_get_reply_menu())
        return

    # ─── 3. Обработка результатов (теперь всегда list) ──────────────
    result = await session.execute(select(Category).where(Category.user_id == current_user.id))
    user_categories = result.scalars().all()

    saved_count = 0

    for item in ai_results:
        ai_amount = Decimal(str(item.get("amount", 0)))
        ai_cat_name = item.get("category", "")
        ai_description = item.get("description", "—")
        entry_type = item.get("type", "expense")

        # Поиск категории
        search_terms = [ai_cat_name.lower()]
        for eng, ru in CATEGORY_TRANSLATIONS.items():
            if ai_cat_name.lower() in ru.lower() or ai_cat_name.lower() in eng.lower():
                search_terms.append(eng.lower())
                search_terms.append(_clean_cat_name(ru).lower())
                break

        category = None
        for cat in user_categories:
            cat_lower = cat.name.lower()
            if any(term in cat_lower for term in search_terms if term):
                category = cat
                break

        # Дефолтная категория
        if not category:
            fallback = (
                "Propulsion (Income)" if entry_type == "income" else "Operations (Rent/Utility)"
            )
            # Попытка 1: поиск по английскому имени (обратная совместимость)
            category = next(
                (c for c in user_categories if fallback.lower() in c.name.lower()), None
            )
            # Попытка 2: поиск по type (expense/income) — работает с русскими названиями
            # 🔥 ИСПРАВЛЕНИЕ: безопасное сравнение — c.type может быть Enum или str
            if not category and user_categories:
                same_type_cats = [
                    c
                    for c in user_categories
                    if getattr(c.type, "value", str(c.type)).lower() == entry_type.lower()
                ]
                if same_type_cats:
                    category = same_type_cats[0]
                else:
                    category = user_categories[0]
                    logger.warning(
                        "No category of type '%s' found for user %d, "
                        "falling back to '%s' (type=%s)",
                        entry_type,
                        current_user.id,
                        category.name,
                        getattr(category.type, "value", category.type),
                    )

        if category:
            raw_key = f"tg_batch_{message.chat.id}_{message.message_id}_{category.id}_{ai_amount}_{saved_count}"
            idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_URL, raw_key))

            tx = Transaction(
                user_id=current_user.id,
                category_id=category.id,
                amount=ai_amount,
                currency="RUB",
                is_recurring=False,
                entry_type=entry_type,
                comment=ai_description,
                executed_at=datetime.now(UTC),
                idempotency_key=idempotency_key,
            )
            session.add(tx)
            saved_count += 1

    if saved_count > 0:
        await session.commit()

    # ─── 4. Ответ пользователю ────────────────────────────────────────
    if len(ai_results) == 1 and saved_count == 1:
        item = ai_results[0]
        cat_name = _loc_category(item.get("category", ""))
        sign = "+" if item.get("type") == "income" else "-"
        await processing_msg.edit_text(
            f"✅ *Успешно распознано и учтено!*\n\n"
            f"💰 *Сумма:* {sign}{item.get('amount', 0):,.2f} ₽\n"
            f"📁 *Категория:* {cat_name}\n"
            f"📝 *Описание:* {item.get('description', '')}",
            parse_mode="Markdown",
        )
    else:
        await processing_msg.edit_text(
            f"✅ *Массовое распознавание завершено!*\n\n"
            f"Успешно сохранено транзакций: *{saved_count}*\n"
            f"Зайди в Web App, чтобы посмотреть детали.",
            parse_mode="Markdown",
        )

    # Гарантируем, что меню не пропадет
    await message.answer("📲 Меню активно", reply_markup=_get_reply_menu())


# ─── Reply Keyboard Button Handlers ─────────────────────────────────────────


@router.message(F.text == "💎 Внести")
async def btn_add_transaction(message: Message, current_user: User | None) -> None:
    if not await check_auth(message, current_user):
        return
    await message.answer(
        "✍️ Отправь мне сумму и категорию, например:\n\n"
        "`500 Кофе`\n"
        "`150000 Зарплата`\n\n"
        "Я всё пойму и разложу по конвертам.",
        parse_mode="Markdown",
        reply_markup=_get_reply_menu(),
    )


@router.message(F.text == "📸 Скан чека")
async def btn_upload_receipt(message: Message, current_user: User | None) -> None:
    if not await check_auth(message, current_user):
        return
    await message.answer(
        "🧾 *Умный сканнер чеков*\n\n"
        "Просто отправь мне фотографию чека или скриншот банковской выписки.\n\n"
        "Я сам прочитаю суммы, угадаю категории и сохраню транзакции!",
        parse_mode="Markdown",
        reply_markup=_get_reply_menu(),
    )


@router.message(F.text == "📊 Баланс")
async def btn_balance_reply(
    message: Message, session: AsyncSession, current_user: User | None
) -> None:
    await cmd_balance(message, session, current_user)


# ─── Smart Text Parser (Natural Language) ──────────────────────────────────


@router.message(F.text.startswith("/"))
async def handle_unknown_command(message: Message) -> None:
    await message.answer(
        "🤔 Я не знаю такой команды.\nВоспользуйся меню внизу экрана или нажми /start",
        parse_mode="Markdown",
        reply_markup=_get_reply_menu(),
    )


@router.message(F.text & ~F.text.startswith("/"))
async def handle_smart_parsing(
    message: Message, session: AsyncSession, current_user: User | None
) -> None:
    if not await check_auth(message, current_user):
        return
    assert current_user is not None

    text = message.text.strip().replace(",", ".")

    if text in ["📊 Баланс", "📁 Конверты", "💎 Внести", "📸 Скан чека"]:
        return

    if re.fullmatch(r"\d{6}", text):
        await message.answer(
            "🤔 Похоже на код привязки, но твой аккаунт уже авторизован!\n\n"
            "Если хочешь войти в другой профиль, отправь `/unlink`.\n"
            "Если это сумма расхода, добавь категорию: `334077 Доход`",
            parse_mode="Markdown",
            reply_markup=_get_reply_menu(),
        )
        return

    amounts = re.findall(r"(\d+(?:\.\d+)?)", text)
    if not amounts:
        await message.answer(
            "🤔 Не вижу суммы в сообщении. Попробуй: `150 кофе`",
            parse_mode="Markdown",
            reply_markup=_get_reply_menu(),
        )
        return

    amount = Decimal(amounts[0])
    category_query = text.replace(amounts[0], "").strip().lower()
    category_query = _fix_layout(category_query)

    if not category_query:
        await _show_category_selection(message, amount, current_user)
        return

    target_db_name = None

    for syn, db_cat in CATEGORY_SYNONYMS.items():
        if syn in category_query:
            target_db_name = db_cat
            break

    if not target_db_name:
        for eng, ru in CATEGORY_TRANSLATIONS.items():
            if category_query in ru.lower():
                target_db_name = eng
                break

    search_terms = [category_query]
    if target_db_name:
        search_terms.append(target_db_name.lower())
        ru_translation = CATEGORY_TRANSLATIONS.get(target_db_name, "")
        if ru_translation:
            search_terms.append(_clean_cat_name(ru_translation).lower())

    result = await session.execute(select(Category).where(Category.user_id == current_user.id))
    user_categories = result.scalars().all()

    category = None
    for cat in user_categories:
        cat_lower = cat.name.lower()
        if any(term in cat_lower for term in search_terms if term):
            category = cat
            break

    if category:
        await _create_bot_transaction(session, message, current_user.id, category, amount)
    else:
        await message.answer(
            f"🔍 Я пока не знаю категорию *'{category_query}'*.\nВыбери подходящий конверт из списка:"
        )
        await _show_category_selection(message, amount, current_user)
