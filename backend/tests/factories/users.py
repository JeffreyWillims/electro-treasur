"""
tests/factories/users.py — Фабрики Данных Пользователя.

Генерирует тестовые данные для доменной модели User с помощью factory_boy + Faker.
Работает с Pydantic-схемами (вывод в виде dict) — а НЕ с прямым сохранением в ORM,
потому что .create() у factory_boy синхронный и несовместим с
async SQLAlchemy. Вместо этого используйте .build(), чтобы получить dict, а затем
сохраняйте его через db_session в тесте.

Использование:
    # В тесте:
    data = UserFactory.build()          # → dict со случайным email, именем, доходом
    user = User(**data)
    db_session.add(user)
    await db_session.flush()
"""

from __future__ import annotations

import factory
from factory import fuzzy


class UserFactory(factory.Factory):
    """
    Генерирует совместимые с User словари с реалистичными случайными данными.

    Поля вывода соответствуют именованным аргументам конструктора src.domain.models.User.
    Пароль заранее хешируется через argon2 для вставки в БД.
    """

    class Meta:
        model = dict  # Вывод обычных словарей, а не экземпляров ORM
        exclude = []

    email = factory.LazyAttribute(
        lambda obj: (
            f"user-{factory.Faker('uuid4').evaluate(None, None, {'locale': None}).split('-')[0]}@citrine-test.dev"
        )
    )
    full_name = factory.Faker("name", locale="ru_RU")
    phone = factory.Faker("phone_number", locale="ru_RU")
    # FuzzyDecimal требует float-границы: внутри вызывается random.uniform(),
    # который падает с TypeError при Decimal-аргументах.
    monthly_income = fuzzy.FuzzyDecimal(low=30000.0, high=500000.0, precision=2)

    @factory.lazy_attribute
    def hashed_password(self) -> str:
        """
        Заранее вычисляет argon2-хеш для 'TestPass123!'.
        Синхронно — безопасно в контексте фабрики (не в event loop).
        """
        from argon2 import PasswordHasher

        ph = PasswordHasher()
        return ph.hash("TestPass123!")
