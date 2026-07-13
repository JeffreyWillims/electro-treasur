# src

Корневой пакет бэкенда Electro-Treasur (Citrine Vault): здесь собраны точка входа приложения, конфигурация, доступ к БД и общие DI-зависимости. Бизнес-логика, роуты, схемы и модели вынесены в соответствующие подпакеты (см. их собственные README.md).

- `__init__.py` — маркер пакета с однострочным описанием проекта («Electro-Treasur — HighLoad Financial Tracker»).
- `admin.py` — SQLAdmin back-office: аутентификация единственного админа по сессии (ET_ADMIN_USERNAME/ET_ADMIN_PASSWORD) и ModelView-регистрация моделей User, Category, Budget, Transaction, BankOffer, Insight, MerchantRule; функция `setup_admin()` монтирует панель в `/admin`.
- `config.py` — класс `Settings` (pydantic-settings) с настройками JWT, PostgreSQL/PgBouncer, Redis, arq, SMTP, Telegram-бота и админ-панели, загружаемыми из переменных окружения с префиксом `ET_`.
- `database.py` — асинхронный SQLAlchemy-движок на asyncpg, фабрика сессий `async_session_factory` и генератор `get_session()` для выдачи сессии с автозакрытием; параметры пула настроены под PgBouncer в transaction-mode.
- `dependencies.py` — FastAPI-зависимости: `get_db()`, `get_redis_client()`, `get_current_user()` (декодирует access-токен из httpOnly cookie) и `require_consultant()` (RBAC-гейт по роли CONSULTANT).
- `main.py` — фабрика FastAPI-приложения `app`: lifespan-хуки, CORS, ProxyHeadersMiddleware, rate-limiter, JSON-логирование запросов, подключение роутеров v1/v2/analytics, монтирование админки и эндпоинт `/health`.
