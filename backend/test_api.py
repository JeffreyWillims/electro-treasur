import asyncio
from decimal import Decimal
from src.schemas.analytics import SimulateRequest, Adjustment
from src.services.analytics_service import get_analytics_profile, simulate_savings
from src.database import async_session_factory
from pydantic import ValidationError


async def run_tests():
    print("=== PHASE 1: BACKEND CHECK ===")
    async with async_session_factory() as session:
        try:
            profile = await get_analytics_profile(session, 1)
            print("Profile fetched:")
            for p in profile.categories:
                print(f" - {p.name}: {p.avg_amount}")
            print(f"Avg income: {profile.avg_income}")
        except Exception as e:
            print("Failed to fetch profile:", e)
            return

    print("\n=== PHASE 2: SIMULATION TEST ===")
    restaurant_cat_id = None
    for c in profile.categories:
        if c.name == "Рестораны":
            restaurant_cat_id = c.category_id

    if not restaurant_cat_id:
        print("Restaurant category not found!")
        return

    adj = []
    # -20% on Restaurants
    for c in profile.categories:
        if c.name == "Рестораны":
            new_amount = c.avg_amount * Decimal("0.8")
            adj.append(Adjustment(category_id=c.category_id, new_amount=new_amount))

    req = SimulateRequest(
        target_amount=Decimal("500000"),
        initial_savings=Decimal("50000"),
        adjustments=adj,
        bank_rate=Decimal("17.0"),
        avg_income=profile.avg_income,
        base_expenses=profile.categories,
    )

    resp = await simulate_savings(req)
    base_date = resp.base_target_date
    opt_date = resp.optimized_target_date
    print(f"Base Date: {base_date}, Optimized Date: {opt_date}")
    if base_date and opt_date:
        diff = (base_date.year - opt_date.year) * 12 + (
            base_date.month - opt_date.month
        )
        print(f"Optimized path reaches goal {diff} months earlier.")

    print("\n=== PHASE 5: EDGE CASES ===")
    try:
        req_zero = req.model_copy()
        req_zero.target_amount = Decimal("0")
        await simulate_savings(req_zero)
        print("ERROR: Target 0 allowed!")
    except ValidationError:
        print("OK: Zero division / Zero target prevented by Pydantic.")


if __name__ == "__main__":
    asyncio.run(run_tests())
