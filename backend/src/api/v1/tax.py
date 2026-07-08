"""
Справочник «Налоги и вычеты» — бесплатный полнотекстовый поиск норм (Postgres FTS).

GET /v1/tax/search?q=...  — релевантные нормы по запросу (websearch_to_tsquery,
                            русский словарь, ранжирование ts_rank). Без q — обзор
                            всех норм по категориям.
GET /v1/tax/categories    — список категорий (для фильтра/меню).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.dependencies import get_current_user
from src.domain.models import TaxRule, User
from src.schemas.tax import (
    DeductionKind,
    DeductionRequest,
    DeductionResult,
    TaxRuleResult,
)
from src.services.tax_deduction_service import DEDUCTION_KINDS, calculate_deduction

router = APIRouter(tags=["Tax Reference"])


@router.get("/search", response_model=list[TaxRuleResult], summary="Full-text search of tax rules")
async def search_tax_rules(
    q: str = Query("", description="Поисковый запрос; пусто → обзор всех норм"),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[TaxRule]:
    query = q.strip()
    if not query:
        stmt = select(TaxRule).order_by(TaxRule.category, TaxRule.title).limit(limit)
        return list((await session.execute(stmt)).scalars().all())

    # OR-семантика: любое слово запроса может совпасть (русский стеммер не роднит
    # глагол «продал» с существительным «продажа»), а ts_rank всё равно поднимает
    # наверх нормы, где совпало больше слов. «or» в websearch_to_tsquery безопасен
    # к стоп-словам и инъекциям.
    or_query = " or ".join(query.split())
    tsq = func.websearch_to_tsquery("russian", or_query)
    stmt = (
        select(TaxRule)
        .where(TaxRule.tsv.op("@@")(tsq))
        .order_by(desc(func.ts_rank(TaxRule.tsv, tsq)), TaxRule.title)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


@router.get("/categories", response_model=list[str], summary="Distinct tax-rule categories")
async def list_categories(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
) -> list[str]:
    stmt = select(TaxRule.category).distinct().order_by(TaxRule.category)
    return list((await session.execute(stmt)).scalars().all())


@router.get("/deductions", response_model=list[DeductionKind], summary="Deduction kinds")
async def list_deduction_kinds(_: User = Depends(get_current_user)) -> list[DeductionKind]:
    return [
        DeductionKind(kind=k, label=str(v["label"]), base_limit=v["base_limit"], note=str(v["note"]))  # type: ignore[arg-type]
        for k, v in DEDUCTION_KINDS.items()
    ]


@router.post("/calc", response_model=DeductionResult, summary="Calculate a tax refund")
async def calc_deduction(
    body: DeductionRequest,
    _: User = Depends(get_current_user),
) -> DeductionResult:
    try:
        result = calculate_deduction(body.kind, body.amount, body.annual_income)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неизвестный вид вычета: {body.kind}",
        ) from exc
    return DeductionResult.model_validate(result)
