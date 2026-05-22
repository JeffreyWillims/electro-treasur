from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.user import (
    CategoryCreate,
    CategoryRead,
    CategoryTransactionCount,
    CategoryUpdate,
    UserRead,
    UserUpdate,
)
from src.services.user_service import (
    count_category_transactions,
    create_user_category,
    delete_user_category,
    update_user_category,
    update_user_profile,
)

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


@router.post("/categories", response_model=CategoryRead, status_code=201)
async def post_user_category(
    category_in: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new custom category for the current user.
    """
    return await create_user_category(db, user_id=current_user.id, category_in=category_in)


@router.get(
    "/categories/{category_id}/transaction-count",
    response_model=CategoryTransactionCount,
)
async def get_category_transaction_count(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Pre-flight safe-delete check: returns the number of transactions
    that would be CASCADE-deleted if this category is removed.

    Returns 404 if the category does not exist or belongs to another user.
    """
    count = await count_category_transactions(db, category_id=category_id, user_id=current_user.id)
    if count == -1:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
    return CategoryTransactionCount(category_id=category_id, transaction_count=count)


@router.patch("/categories/{category_id}", response_model=CategoryRead)
async def patch_user_category(
    category_id: int,
    category_in: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Partially update a category's name and/or icon color (HEX string).
    Returns 404 if not found or not owned by the current user.
    """
    updated = await update_user_category(
        db,
        category_id=category_id,
        user_id=current_user.id,
        payload=category_in,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
    return updated


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_category_route(
    category_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Hard-delete a category. All linked Transactions and Budgets are
    CASCADE-deleted at the PostgreSQL level (FK ondelete='CASCADE').

    THIS IS IRREVERSIBLE. The frontend enforces a confirmation dialog
    with a mandatory text input ('УДАЛИТЬ') when transactions exist.

    Returns 204 No Content on success, 404 if not found / not owned.
    """
    deleted = await delete_user_category(
        db,
        category_id=category_id,
        user_id=current_user.id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found.",
        )
