"""
tests/factories/transactions.py — Transaction Data Factories.

Generates test data for TransactionCreate Pydantic schema
and raw Transaction ORM model dicts.

Usage:
    # Generate a valid TransactionCreate payload dict:
    payload = TransactionCreateFactory.build()
    # → {"category_id": 1, "amount": "1523.45", "currency": "RUB", ...}

    # Send to API:
    resp = await client.post("/v1/transactions/", json=payload)
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import factory
from factory import fuzzy


class TransactionCreateFactory(factory.Factory):
    """
    Generates dicts matching src.schemas.transaction.TransactionCreate.

    All fields respect Pydantic V2 Field constraints:
      • amount: Decimal, max_digits=12, decimal_places=2
      • currency: ISO 4217 code (defaults to RUB)
      • executed_at: timezone-aware datetime
    """

    class Meta:
        model = dict

    category_id = factory.LazyAttribute(lambda _: 1)  # Overridden in tests
    amount = fuzzy.FuzzyDecimal(low=Decimal("10.00"), high=Decimal("99999.99"), precision=2)
    currency = "RUB"
    is_recurring = False
    entry_type = "manual"
    executed_at = factory.LazyFunction(lambda: datetime.now(UTC).isoformat())
    comment = factory.Faker("sentence", nb_words=4, locale="ru_RU")

    @classmethod
    def build_json(cls, **kwargs: object) -> dict:
        """
        Build a dict safe for JSON serialization (Decimal → str).

        httpx serializes Decimal as-is, but JSON requires string representation
        for exact decimal precision. This method ensures clean API payloads.
        """
        data = cls.build(**kwargs)
        # Convert Decimal to string for JSON serialization
        if isinstance(data.get("amount"), Decimal):
            data["amount"] = str(data["amount"])
        return data


class CategoryFactory(factory.Factory):
    """
    Generates dicts matching src.domain.models.Category constructor.

    Used in integration tests to seed prerequisite FK data.
    """

    class Meta:
        model = dict

    name = factory.Faker("word", locale="ru_RU")
    type = fuzzy.FuzzyChoice(["income", "expense"])
    icon = factory.LazyFunction(
        lambda: f"#{factory.Faker('hex_color').evaluate(None, None, {'locale': None}).lstrip('#')}"
    )
