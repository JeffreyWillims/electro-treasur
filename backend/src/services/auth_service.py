import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel

# ── Security Configuration ───────────────────────────────────────────
SECRET_KEY = "SUPER_SECRET_ORBITAL_KEY_CHANGE_ME" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours for MVP stability

ph = PasswordHasher()


class TokenData(BaseModel):
    email: str | None = None


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """
    Encodes data into a JWT access token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain password against its hashed version using Argon2 inside a thread pool.
    """
    def _verify():
        try:
            return ph.verify(hashed_password, plain_password)
        except VerifyMismatchError:
            return False
            
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _verify)


async def get_password_hash(password: str) -> str:
    """
    Generates an Argon2 hash of the password inside a thread pool.
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, ph.hash, password)


def decode_access_token(token: str) -> TokenData:
    """
    Decodes and validates a JWT token.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise JWTError("Invalid token: missing subject")
        return TokenData(email=email)
    except JWTError as e:
        raise e
