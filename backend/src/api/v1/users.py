from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.user import CategoryCreate, CategoryRead, UserRead, UserUpdate
from src.services.user_service import create_user_category, update_user_profile

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


@router.post(
    "/categories", response_model=CategoryRead, status_code=201
)
async def post_user_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new custom category for the current user.
    """
    return await create_user_category(db, user_id=current_user.id, category_in=category_in)
