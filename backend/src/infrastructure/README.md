# src/infrastructure/

Инфраструктурный слой: интеграции с внешними системами (Redis, Telegram, фоновые воркеры), не относящиеся к бизнес-логике домена.

| Файл | Назначение |
|---|---|
| `__init__.py` | Пустой маркер пакета (docstring "Пакет инфраструктуры") |
| `redis_client.py` | Асинхронный клиент Redis: пул соединений (`get_redis`/`close_redis`) и хранилище refresh-токенов (store/is_valid/delete) |

Подпапки `telegram/` и `workers/` описаны отдельными README.md внутри них.
