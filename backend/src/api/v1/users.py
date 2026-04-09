from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.user import UserRead, UserUpdate, CategoryRead
from src.services.user_service import update_user_profile

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get current user profile.
    """
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Update current user profile (contact information, budget settings).
    """
    return await update_user_profile(
        db, db_user=current_user, update_data=user_in.model_dump(exclude_unset=True)
    )


@router.get("/categories", response_model=list[CategoryRead])
async def get_user_categories(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get all categories for the current user.
    """
    return current_user.categories
