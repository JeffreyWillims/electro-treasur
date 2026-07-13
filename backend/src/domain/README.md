# domain

Доменный слой: декларативные ORM-модели SQLAlchemy 2.0, описывающие нормализованную финансовую предметную область приложения (пользователи, категории, бюджеты, транзакции и связанные с ними сущности).

- `__init__.py` — маркер пакета доменного слоя.
- `models.py` — все ORM-модели на общем `Base`: `User`, `Category`, `Budget`, `Transaction`, `BankOffer`, `Feedback`, `GameScore`, `Notification`, `ConsultantAccess`, `ApiKey`, `MerchantRule`, `Insight`, `SavingsGoal`, `TaxRule`, а также enum'ы `CategoryType` и `UserRole`; денежные суммы хранятся как `NUMERIC(12,2)`, `Transaction.idempotency_key` защищён уникальным индексом от повторной записи.
