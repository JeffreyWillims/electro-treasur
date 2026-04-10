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
    name: str
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
