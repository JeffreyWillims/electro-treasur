"""
Import / Export Service — Data Vault for Citrine Vault.

Architecture:
  • Export: Single JOIN query → CSV with UTF-8 BOM → BytesIO stream.
  • Import: pandas parse → dynamic category auto-creation → batch INSERT
    with ON CONFLICT DO NOTHING on idempotency_key.

Idempotency:
  Transaction.idempotency_key is PG_UUID(as_uuid=False). We generate
  deterministic UUIDs via uuid.uuid5(NAMESPACE_URL, payload_hash) to
  produce collision-resistant, DB-compatible keys from row content.

Complexity:
  • Export: O(N) — single sequential scan with index on (user_id, executed_at).
  • Import: O(N) parse + O(K) category resolution + O(N) batch insert.
"""

from __future__ import annotations

import csv
import io
import logging
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.domain.models import Category, CategoryType, Transaction

logger = logging.getLogger(__name__)

# Column name aliases — case-insensitive matching for flexible imports.
_COL_ALIASES: dict[str, list[str]] = {
    "date": ["date", "дата", "executed_at", "datetime", "transaction_date"],
    "amount": ["amount", "сумма", "sum", "value"],
    "category": ["category", "категория", "category_name", "cat"],
    "comment": ["comment", "комментарий", "description", "note", "memo", "описание"],
}


@dataclass
class ImportResult:
    """Statistics returned to the client after an import operation."""

    created: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


# ── EXPORT ─────────────────────────────────────────────────────────────────────


async def export_transactions_csv(
    session: AsyncSession,
    user_id: int,
) -> io.BytesIO:
    """
    Export all user transactions as a UTF-8 BOM CSV file.

    BOM prefix (\\xef\\xbb\\xbf) guarantees Microsoft Excel auto-detects
    UTF-8 encoding for Cyrillic content without manual import wizard.

    Returns a BytesIO buffer ready for StreamingResponse.
    """
    stmt = (
        select(
            Transaction.executed_at,
            Transaction.amount,
            Category.name.label("category_name"),
            Category.type.label("category_type"),
            Transaction.currency,
            Transaction.comment,
            Transaction.entry_type,
        )
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.executed_at.desc())
    )

    result = await session.execute(stmt)
    rows = result.all()

    buffer = io.BytesIO()
    # UTF-8 BOM for Excel compatibility
    buffer.write(b"\xef\xbb\xbf")

    wrapper = io.TextIOWrapper(buffer, encoding="utf-8", newline="")
    writer = csv.writer(wrapper)

    # Header row
    writer.writerow(["Date", "Amount", "Category", "Type", "Currency", "Comment", "Entry Type"])

    for row in rows:
        executed_at: datetime = row.executed_at
        writer.writerow(
            [
                executed_at.strftime("%Y-%m-%d %H:%M"),
                str(row.amount),
                row.category_name,
                row.category_type,
                row.currency,
                row.comment or "",
                row.entry_type,
            ]
        )

    wrapper.detach()  # Detach without closing the underlying BytesIO
    buffer.seek(0)
    return buffer


# ── IMPORT ─────────────────────────────────────────────────────────────────────


def _resolve_columns(df: pd.DataFrame) -> dict[str, str]:
    """
    Map required logical column names to actual DataFrame column names.

    Uses case-insensitive alias matching. Returns a dict:
      {"date": "actual_col_name", "amount": "actual_col_name", ...}

    Raises ValueError if a required column (date, amount) is not found.
    """
    df_cols_lower = {c.lower().strip(): c for c in df.columns}
    resolved: dict[str, str] = {}

    for logical_name, aliases in _COL_ALIASES.items():
        for alias in aliases:
            if alias in df_cols_lower:
                resolved[logical_name] = df_cols_lower[alias]
                break

    # Validate required columns
    for required in ("date", "amount"):
        if required not in resolved:
            available = ", ".join(df.columns.tolist())
            msg = (
                f"Обязательная колонка '{required}' не найдена. "
                f"Доступные колонки: [{available}]. "
                f"Допустимые имена: {_COL_ALIASES[required]}"
            )
            raise ValueError(msg)

    return resolved


def _parse_amount(raw: Any) -> Decimal:
    """Parse a monetary value from various string/numeric formats."""
    if isinstance(raw, (int, float)):
        return Decimal(str(raw))
    if isinstance(raw, Decimal):
        return raw
    # String cleanup: remove spaces, replace comma decimal separator
    cleaned = str(raw).strip().replace(" ", "").replace(",", ".")
    return Decimal(cleaned)


async def import_transactions(
    session: AsyncSession,
    user_id: int,
    file_bytes: bytes,
    filename: str,
) -> ImportResult:
    """
    Import transactions from a CSV or Excel file.

    Algorithm:
      1. Parse file via pandas (CSV or Excel, auto-detected by extension).
      2. Resolve column names via case-insensitive alias matching.
      3. Fetch existing user categories; auto-create missing ones.
      4. Generate deterministic UUID idempotency keys from row content.
      5. Batch INSERT with ON CONFLICT DO NOTHING — zero duplicates.

    Args:
        session: Async SQLAlchemy session.
        user_id: Authenticated user ID.
        file_bytes: Raw file content.
        filename: Original filename (for extension detection).

    Returns:
        ImportResult with created/skipped counts and error messages.
    """
    result = ImportResult()

    # ── Step 1: Parse file ─────────────────────────────────────────────
    ext = filename.rsplit(".", maxsplit=1)[-1].lower() if "." in filename else ""

    try:
        if ext == "csv":
            # Try UTF-8 first, fall back to cp1251 (common Russian Windows encoding)
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8-sig")
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding="cp1251")
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
        else:
            result.errors.append(f"Неподдерживаемый формат файла: .{ext}")
            return result
    except Exception as exc:
        logger.error("Failed to parse import file '%s': %s", filename, exc)
        result.errors.append(f"Ошибка парсинга файла: {exc}")
        return result

    if df.empty:
        result.errors.append("Файл не содержит данных.")
        return result

    # Strip whitespace from column names
    df.columns = df.columns.str.strip()

    # ── Step 2: Resolve columns ────────────────────────────────────────
    try:
        col_map = _resolve_columns(df)
    except ValueError as exc:
        result.errors.append(str(exc))
        return result

    date_col = col_map["date"]
    amount_col = col_map["amount"]
    category_col = col_map.get("category")
    comment_col = col_map.get("comment")

    # ── Step 3: Load/create categories ─────────────────────────────────
    cat_result = await session.execute(select(Category).where(Category.user_id == user_id))
    existing_cats: dict[str, Category] = {
        c.name.lower().strip(): c for c in cat_result.scalars().all()
    }

    # Collect unique category names from the file that don't exist yet
    new_cat_names: set[str] = set()
    if category_col is not None:
        for raw_name in df[category_col].dropna().unique():
            name_str = str(raw_name).strip()
            if name_str and name_str.lower() not in existing_cats:
                new_cat_names.add(name_str)

    # Determine type heuristic: check the first row with this category
    # to decide income vs expense based on amount sign
    cat_type_hints: dict[str, CategoryType] = {}
    if category_col is not None:
        for name_str in new_cat_names:
            # Find the first row with this category to peek at amount sign
            mask = df[category_col].astype(str).str.strip().str.lower() == name_str.lower()
            first_match = df.loc[mask, amount_col].head(1)
            if not first_match.empty:
                try:
                    amt = _parse_amount(first_match.iloc[0])
                    cat_type_hints[name_str.lower()] = (
                        CategoryType.income if amt > 0 else CategoryType.expense
                    )
                except (InvalidOperation, ValueError):
                    cat_type_hints[name_str.lower()] = CategoryType.expense
            else:
                cat_type_hints[name_str.lower()] = CategoryType.expense

    # Bulk create missing categories
    for name_str in new_cat_names:
        cat_type = cat_type_hints.get(name_str.lower(), CategoryType.expense)
        new_cat = Category(
            user_id=user_id,
            name=name_str,
            type=cat_type,
            icon=None,
        )
        session.add(new_cat)

    if new_cat_names:
        await session.flush()
        # Reload all categories after creation
        cat_result2 = await session.execute(select(Category).where(Category.user_id == user_id))
        existing_cats = {c.name.lower().strip(): c for c in cat_result2.scalars().all()}
        logger.info(
            "Auto-created %d new categories for user %d: %s",
            len(new_cat_names),
            user_id,
            new_cat_names,
        )

    # Fallback category: first expense category, or create "Импорт"
    fallback_cat: Category | None = None
    for cat in existing_cats.values():
        if cat.type == CategoryType.expense:
            fallback_cat = cat
            break
    if fallback_cat is None:
        fallback_cat = Category(
            user_id=user_id,
            name="Импорт",
            type=CategoryType.expense,
            icon=None,
        )
        session.add(fallback_cat)
        await session.flush()
        existing_cats["импорт"] = fallback_cat

    # ── Step 4: Build transaction rows ─────────────────────────────────
    insert_values: list[dict[str, Any]] = []

    for idx, row in df.iterrows():
        row_num = int(idx) + 2  # +2: header row + 0-indexed → human row number

        # Parse date
        raw_date = row.get(date_col)
        if pd.isna(raw_date):
            result.errors.append(f"Строка {row_num}: пустая дата — пропущена.")
            result.skipped += 1
            continue

        try:
            if isinstance(raw_date, pd.Timestamp):
                executed_at = raw_date.to_pydatetime().replace(tzinfo=UTC)
            elif isinstance(raw_date, datetime):
                executed_at = raw_date.replace(tzinfo=UTC)
            else:
                parsed = pd.to_datetime(str(raw_date), dayfirst=True)
                executed_at = parsed.to_pydatetime().replace(tzinfo=UTC)
        except Exception:
            result.errors.append(f"Строка {row_num}: некорректная дата '{raw_date}' — пропущена.")
            result.skipped += 1
            continue

        # Parse amount
        raw_amount = row.get(amount_col)
        if pd.isna(raw_amount):
            result.errors.append(f"Строка {row_num}: пустая сумма — пропущена.")
            result.skipped += 1
            continue

        try:
            amount = _parse_amount(raw_amount)
            if amount == 0:
                result.skipped += 1
                continue
        except (InvalidOperation, ValueError):
            result.errors.append(
                f"Строка {row_num}: некорректная сумма '{raw_amount}' — пропущена."
            )
            result.skipped += 1
            continue

        # Resolve category
        cat_name_raw = row.get(category_col) if category_col else None
        if pd.notna(cat_name_raw) and str(cat_name_raw).strip():
            cat_key = str(cat_name_raw).strip().lower()
            category = existing_cats.get(cat_key, fallback_cat)
        else:
            category = fallback_cat

        # Parse comment
        comment_raw = row.get(comment_col) if comment_col else None
        comment = str(comment_raw).strip() if pd.notna(comment_raw) else None
        if comment:
            comment = comment[:255]  # Truncate to DB column limit

        # Generate deterministic UUID idempotency key
        # Payload: user_id + date ISO + amount + comment
        date_iso = executed_at.strftime("%Y-%m-%dT%H:%M:%S")
        comment_for_key = comment or ""
        key_payload = f"import_{user_id}_{date_iso}_{amount}_{comment_for_key}"
        idempotency_key = str(uuid.uuid5(uuid.NAMESPACE_URL, key_payload))

        # Use absolute amount — sign handled by category type
        abs_amount = abs(amount)

        insert_values.append(
            {
                "user_id": user_id,
                "category_id": category.id,
                "amount": abs_amount,
                "currency": "RUB",
                "is_recurring": False,
                "entry_type": "import",
                "comment": comment,
                "executed_at": executed_at,
                "idempotency_key": idempotency_key,
            }
        )

    if not insert_values:
        if not result.errors:
            result.errors.append("Не найдено валидных строк для импорта.")
        return result

    # ── Step 5: Batch INSERT with ON CONFLICT DO NOTHING ───────────────
    stmt = (
        pg_insert(Transaction)
        .values(insert_values)
        .on_conflict_do_nothing(constraint="uq_transaction_idempotency")
    )

    exec_result = await session.execute(stmt)
    await session.commit()

    actually_inserted = exec_result.rowcount  # type: ignore

    result.created = actually_inserted
    result.skipped += len(insert_values) - actually_inserted

    logger.info(
        "Import complete for user %d: created=%d, skipped=%d, errors=%d",
        user_id,
        result.created,
        result.skipped,
        len(result.errors),
    )

    return result
