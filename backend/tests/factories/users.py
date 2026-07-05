"""
tests/factories/users.py — User Data Factories.

Generates test data for User domain model using factory_boy + Faker.
Works with Pydantic schemas (dict output) — NOT direct ORM persistence,
because factory_boy's .create() is synchronous and incompatible with
async SQLAlchemy. Instead, use .build() to get a dict, then persist
via db_session in the test.

Usage:
    # In a test:
    data = UserFactory.build()          # → dict with random email, name, income
    user = User(**data)
    db_session.add(user)
    await db_session.flush()
"""

from __future__ import annotations

import factory
from factory import fuzzy


class UserFactory(factory.Factory):
    """
    Generates User-compatible dicts with realistic random data.

    Output fields match src.domain.models.User constructor kwargs.
    Password is pre-hashed with argon2 for DB insertion.
    """

    class Meta:
        model = dict  # Output plain dicts, not ORM instances
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
        Pre-compute an argon2 hash for 'TestPass123!'.
        Synchronous — safe in factory context (not in event loop).
        """
        from argon2 import PasswordHasher

        ph = PasswordHasher()
        return ph.hash("TestPass123!")
