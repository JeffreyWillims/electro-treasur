import asyncio
import sys
import os

# Add src to path
sys.path.append(os.path.join(os.getcwd(), 'src'))
# Also add current dir to path just in case
sys.path.append(os.getcwd())

from sqlalchemy.ext.asyncio import AsyncSession
from src.database import async_session_factory
from src.services.user_service import create_user
from src.services.auth_service import ph

async def test_creation():
    print("🚀 Triggering Database Diagnostic Probe...")
    async with async_session_factory() as session:
        try:
            print("📡 Attempting User Creation (Test Vector A)...")
            user_data = {
                "email": "debug_test@aura.com",
                "password": "Password123!",
                "full_name": "Diagnostic Probe",
                "phone": "+700000000"
            }
            user = await create_user(session, user_data)
            print(f"✅ User Created Successfully! ID: {user.id}")
        except Exception as e:
            print(f"❌ Trajectory Violation Detected: {type(e).__name__}")
            print(f"Details: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_creation())
