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

limiter = Limiter(key_func=get_remote_address)
