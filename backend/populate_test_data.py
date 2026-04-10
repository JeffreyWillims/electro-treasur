import asyncio
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from src.domain.models import Base, Category, CategoryType, Transaction, User

DATABASE_URL = (
    "postgresql+asyncpg://electro:electro_secret@localhost:5432/electro_treasur"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # Create user
        user = (
            await session.execute(select(User).where(User.id == 1))
        ).scalar_one_or_none()
        if not user:
            user = User(id=1, email="test@electro.local")
            session.add(user)
            await session.commit()

        # Create categories
        categories_data = [
            ("Продукты", CategoryType.expense),
            ("Рестораны", CategoryType.expense),
            ("Транспорт", CategoryType.expense),
            ("Еда", CategoryType.expense),
            ("Здоровье", CategoryType.expense),
            ("Зарплата", CategoryType.income),
        ]

        cats = {}
        for name, ctype in categories_data:
            cat = (
                await session.execute(
                    select(Category).where(Category.name == name, Category.user_id == 1)
                )
            ).scalar_one_or_none()
            if not cat:
                cat = Category(user_id=1, name=name, type=ctype)
                session.add(cat)
                await session.commit()
                await session.refresh(cat)
            cats[name] = cat

        # Clear old transactions to have clean test
        # Actually just add 90 days.
        today = datetime.now()

        # Monthly income: ~150k
        # Monthly expenses: ~100k
        import random

        random.seed(42)

        for i in range(90):
            current_day = today - timedelta(days=i)

            # daily food ~1500
            t1 = Transaction(
                user_id=1,
                category_id=cats["Продукты"].id,
                amount=Decimal(random.randint(1000, 2000)),
                executed_at=current_day,
                idempotency_key=str(uuid.uuid4()),
            )

            # transport ~500
            t2 = Transaction(
                user_id=1,
                category_id=cats["Транспорт"].id,
                amount=Decimal(random.randint(200, 800)),
                executed_at=current_day,
                idempotency_key=str(uuid.uuid4()),
            )

            session.add_all([t1, t2])

            # restaurants every 3 days ~3000
            if i % 3 == 0:
                t3 = Transaction(
                    user_id=1,
                    category_id=cats["Рестораны"].id,
                    amount=Decimal(random.randint(2000, 4000)),
                    executed_at=current_day,
                    idempotency_key=str(uuid.uuid4()),
                )
                session.add(t3)

            # salary every 30 days
            if i % 30 == 0:
                # 150_000
                t_inc = Transaction(
                    user_id=1,
                    category_id=cats["Зарплата"].id,
                    amount=Decimal("150000"),
                    executed_at=current_day,
                    idempotency_key=str(uuid.uuid4()),
                )
                session.add(t_inc)

        await session.commit()
        print("Test data inserted successfully. Categories:", list(cats.keys()))


if __name__ == "__main__":
    asyncio.run(main())
