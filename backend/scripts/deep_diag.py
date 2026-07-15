import asyncio
import os
import sys

# Добавляем src в путь поиска модулей
sys.path.append(os.path.join(os.getcwd(), "src"))
sys.path.append(os.getcwd())

from sqlalchemy import inspect, text  # noqa: E402

from src.database import async_session_factory, engine  # noqa: E402
from src.domain.models import User  # noqa: E402


async def diagnose():
    print("🔍 Starting Deep Diagnostic Probe...")

    # 1. Проверяем базовое соединение
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"📡 DB Connectivity: OK ({result.scalar()})")
    except Exception as e:
        print(f"❌ DB Connectivity FAILED: {str(e)}")
        return

    # 2. Проверяем таблицу User
    try:

        def get_columns(connection):
            inst = inspect(connection)
            return inst.get_columns("users")

        async with engine.connect() as conn:
            columns = await conn.run_sync(get_columns)
            col_names = [c["name"] for c in columns]
            print(f"📊 Table 'users' columns: {col_names}")
            if "monthly_income" not in col_names:
                print("⚠️ CRITICAL: 'monthly_income' column IS MISSING!")
            else:
                print("✅ 'monthly_income' column found.")
    except Exception as e:
        print(f"❌ Table Inspection FAILED: {str(e)}")

    # 3. Проверяем прямое создание пользователя
    async with async_session_factory() as session:
        try:
            print("🧪 Attempting atomic user creation...")
            u = User(
                email="diag_user@aura.com",
                hashed_password="fake_hash",
                full_name="Diag",
                # monthly_income теперь должен использовать default=Decimal("0")
            )
            session.add(u)
            await session.commit()
            print(f"✅ User creation successful. ID: {u.id}")

            # Убираем за собой
            await session.delete(u)
            await session.commit()
            print("🧹 Cleanup complete.")
        except Exception as e:
            print(f"❌ Atomic creation FAILED: {type(e).__name__}")
            print(f"Details: {str(e)}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(diagnose())
