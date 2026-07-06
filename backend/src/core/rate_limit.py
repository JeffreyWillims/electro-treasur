"""
rate_limit.py — Centralized SlowAPI Rate Limiter Instance.

Single source of truth for the limiter object.
Import `limiter` from here in:
  • main.py  → attach to app.state + register error handler
  • auth.py  → decorate /login and /register endpoints

Key function: get_remote_address — identifies clients by real IP.
On VPS behind Nginx/Traefik, ensure X-Forwarded-For or X-Real-IP
is forwarded and trusted (configure ProxyHeadersMiddleware if needed).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from src.config import settings

# storage_uri=Redis: счётчики общие для всех uvicorn-воркеров и реплик (иначе
# in-memory лимит эффективно умножался на число воркеров). in_memory_fallback:
# если Redis недоступен — деградируем на локальный счётчик, а не роняем все
# запросы 500-кой. Реальный IP клиента даёт ProxyHeadersMiddleware в main.py.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.ratelimit_storage_uri or settings.redis_url,
    in_memory_fallback_enabled=True,
)
