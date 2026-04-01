import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from src.database import async_session_factory
from src.domain.models import User, Category, Budget
from datetime import date

async def main():
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == 'beta@aura.com'))
        user = result.scalar_one_or_none()
        if not user:
            print("User Beta not found")
            return

        print(f"User Beta found: {user.id}")
        # Find or create category 'Аренда'
        res = await session.execute(select(Category).where(Category.user_id == user.id, Category.name == 'Аренда'))
        cat = res.scalar_one_or_none()
        if not cat:
            cat = Category(user_id=user.id, name='Аренда', type='expense', icon='🏠')
            session.add(cat)
            await session.commit()
            await session.refresh(cat)
            
        # Check if budget already exists
        res = await session.execute(select(Budget).where(Budget.user_id == user.id, Budget.category_id == cat.id))
        if res.scalar_one_or_none():
            print("Budget already exists")
            return

        # Create budget constraint
        today = date.today()
        b = Budget(user_id=user.id, category_id=cat.id, amount_limit=50000, month=today.month, year=today.year)
        session.add(b)
        await session.commit()
        print("Budget injected for Beta")

if __name__ == '__main__':
    asyncio.run(main())
