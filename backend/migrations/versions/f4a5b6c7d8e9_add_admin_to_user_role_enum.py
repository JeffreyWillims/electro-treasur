"""добавить значение 'admin' в user_role_enum

Идемпотентная миграция: на проде значение уже добавлено вручную, поэтому
используем ADD VALUE IF NOT EXISTS — на существующей БД это no-op, на свежей
создаёт значение. Без него загрузка пользователя-админа падала на маппинге
SQLAlchemy (LookupError → 500 на логине), т.к. Python-enum UserRole про 'admin'
не знал. PostgreSQL 12+ допускает ADD VALUE внутри транзакции (значение просто
нельзя использовать в той же транзакции — мы его и не используем).

Revision ID: f4a5b6c7d8e9
Revises: a7f3d91c2b84
Create Date: 2026-07-22 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# идентификаторы ревизии, используются Alembic.
revision: str = "f4a5b6c7d8e9"
down_revision: str | None = "a7f3d91c2b84"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'admin'")


def downgrade() -> None:
    # PostgreSQL не умеет безопасно удалять значение enum (нужен пересоздание
    # типа с переносом всех колонок). Откат — намеренный no-op: лишнее значение
    # в enum безвредно, а старый код его просто не использует.
    pass
