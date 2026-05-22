from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str | None = None
    phone: str | None = None
    monthly_income: Decimal = Field(default=Decimal("0"))


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    monthly_income: Decimal | None = None


class UserRead(UserBase):
    id: int

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    type: str
    icon: str | None = None
    parent_id: int | None = None


class CategoryRead(BaseModel):
    id: int
    name: str
    type: str
    icon: str | None = None
    parent_id: int | None = None

    class Config:
        from_attributes = True


class CategoryUpdate(BaseModel):
    """Partial update payload for PATCH /users/categories/{id}."""

    name: str | None = Field(default=None, min_length=1, max_length=128)
    icon: str | None = None  # HEX color string, e.g. "#FF7A00"


class CategoryTransactionCount(BaseModel):
    """Response payload for the safe-delete pre-flight check."""

    category_id: int
    transaction_count: int
