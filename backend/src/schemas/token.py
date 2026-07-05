from pydantic import BaseModel

# Токены больше не возвращаются в теле ответа — они уходят в httpOnly-cookie
# (см. src/api/v1/auth.py). Поэтому Token/RefreshRequest-схемы удалены.


class TokenData(BaseModel):
    email: str | None = None
