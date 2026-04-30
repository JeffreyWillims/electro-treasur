from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.dependencies import get_current_user, get_db
from src.domain.models import User
from src.schemas.budget import BudgetUpsert
from src.services.budget_service import delete_budget, upsert_budget

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.put("/", status_code=status.HTTP_200_OK)
async def set_budget_limit(
    payload: BudgetUpsert,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        budget = await upsert_budget(
            session=db,
            user_id=current_user.id,
            category_id=payload.category_id,
            month=payload.month,
            year=payload.year,
            amount_limit=payload.amount_limit,
        )
        return {"status": "success", "amount_limit": str(budget.amount_limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_budget(
    category_id: int,
    month: int = Query(...),
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        deleted = await delete_budget(db, current_user.id, category_id, month, year)
        if not deleted:
            raise HTTPException(status_code=404, detail="Budget not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
