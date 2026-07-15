"""
Pydantic V2-схемы роли CONSULTANT (RBAC, доступ к клиенту только на чтение).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class GrantAccessRequest(BaseModel):
    """POST /consultant/access body — клиент выдаёт доступ по email консультанта."""

    consultant_email: EmailStr


class ClientInfo(BaseModel):
    """Клиент в списке консультанта."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None = None


class GrantInfo(BaseModel):
    """Выданный грант со стороны клиента."""

    consultant_id: int
    consultant_email: str
    created_at: datetime
