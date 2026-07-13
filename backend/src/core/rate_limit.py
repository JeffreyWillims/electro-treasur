"""
rate_limit.py — централизованный экземпляр SlowAPI Rate Limiter.

Единый источник истины для объекта limiter.
Импортируйте `limiter` отсюда в:
  • main.py  → прикрепить к app.state + зарегистрировать обработчик ошибок
  • auth.py  → декорировать эндпоинты /login и /register

Ключевая функция: get_remote_address — определяет клиентов по реальному IP.
На VPS за Nginx/Traefik убедитесь, что X-Forwarded-For или X-Real-IP
передаётся и доверенный (настройте ProxyHeadersMiddleware при необходимости).
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
