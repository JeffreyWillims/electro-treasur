# tests/factories

Фабрики тестовых данных (factory_boy + Faker). Работают с Pydantic-схемами
(`.build()` → dict), а не с прямым сохранением в ORM — `.create()` у factory_boy
синхронный и несовместим с async SQLAlchemy.

- `__init__.py` — маркер пакета, пустой.
- `transactions.py` — фабрика данных для `TransactionCreate` и сырых словарей ORM-модели `Transaction`.
- `users.py` — фабрика данных для доменной модели `User`.
