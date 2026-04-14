import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from src.services.user_service import create_user

DATABASE_URL = (
    "postgresql+asyncpg://electro:electro_secret@localhost:5432/electro_treasur"
)
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def seed_vanguard_user():
    async with AsyncSessionLocal() as session:
        user_data = {
            "email": "test@electro.local",
            "password": "vanguard123",
            "full_name": "Vanguard Pilot",
            "phone": "+79998887766",
        }
        user = await create_user(session, user_in=user_data)
        print(f"User created: {user.email}")


if __name__ == "__main__":
    asyncio.run(seed_vanguard_user())
