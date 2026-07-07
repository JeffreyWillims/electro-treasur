"""
Savings Goals — режим «Цель» Savings Navigator, сохранённый в приложение (ретеншн).

POST   /v1/goals/                 — создать цель (из калькулятора «Цель»).
GET    /v1/goals/                 — список целей с прогрессом (для дашборда).
PATCH  /v1/goals/{id}/contribute  — пополнить фактическую сумму (current_amount).
DELETE /v1/goals/{id}             — удалить цель.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import SavingsGoal, User
from src.schemas.goal import GoalContribute, GoalCreate, GoalResponse

router = APIRouter(tags=["Savings Goals"])


def _to_response(goal: SavingsGoal) -> GoalResponse:
    """Цель → ответ с вычисленным прогрессом (current/target, capped 0..100)."""
    pct = min(goal.current_amount / goal.target_amount * 100, Decimal("100"))
    remaining = goal.target_amount - goal.current_amount
    return GoalResponse(
        id=goal.id,
        name=goal.name,
        target_amount=goal.target_amount,
        target_date=goal.target_date,
        monthly_plan=goal.monthly_plan,
        current_amount=goal.current_amount,
        created_at=goal.created_at,
        progress_pct=round(float(pct), 1),
        remaining=max(remaining, Decimal("0.00")),
    )


async def _owned_goal(goal_id: int, session: AsyncSession, user: User) -> SavingsGoal:
    goal = await session.get(SavingsGoal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    return goal


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    body: GoalCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    goal = SavingsGoal(
        user_id=current_user.id,
        name=body.name,
        target_amount=body.target_amount,
        target_date=body.target_date,
        monthly_plan=body.monthly_plan,
    )
    session.add(goal)
    await session.commit()
    await session.refresh(goal)
    return _to_response(goal)


@router.get("/", response_model=list[GoalResponse], summary="Savings goals with progress")
async def list_goals(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[GoalResponse]:
    stmt = (
        select(SavingsGoal)
        .where(SavingsGoal.user_id == current_user.id)
        .order_by(SavingsGoal.created_at.desc())
    )
    rows = (await session.execute(stmt)).scalars().all()
    return [_to_response(g) for g in rows]


@router.patch("/{goal_id}/contribute", response_model=GoalResponse)
async def contribute(
    goal_id: int,
    body: GoalContribute,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> GoalResponse:
    goal = await _owned_goal(goal_id, session, current_user)
    goal.current_amount += body.amount
    await session.commit()
    await session.refresh(goal)
    return _to_response(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    goal = await _owned_goal(goal_id, session, current_user)
    await session.delete(goal)
    await session.commit()
