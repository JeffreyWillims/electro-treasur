"""
tests/factories/transactions.py — Фабрики Данных Транзакций.

Генерирует тестовые данные для Pydantic-схемы TransactionCreate
и сырые словари для ORM-модели Transaction.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

import factory
from factory import fuzzy


class TransactionCreateFactory(factory.Factory):
    """
    Генерирует словари, соответствующие схеме src.schemas.transaction.TransactionCreate.

    Все поля соблюдают ограничения (constraints) Pydantic V2 Field:
      • amount: Decimal, max_digits=12, decimal_places=2
      • currency: Код стандарта ISO 4217 (по умолчанию RUB)
      • executed_at: datetime с учетом часового пояса (timezone-aware)
    """

    class Meta:
        # Указываем, что фабрика будет производить обычные словари (dict)
        model = dict

    # LazyAttribute позволяет вычислять значение на лету.
    # В реальных тестах category_id будет переопределяться (override)
    category_id = factory.LazyAttribute(lambda _: 1)

    # FuzzyDecimal требует float-границы (под капотом работает random.uniform).
    amount = fuzzy.FuzzyDecimal(low=10.00, high=99999.99, precision=2)
    currency = "RUB"
    is_recurring = False
    entry_type = "manual"

    # Выполняем datetime.now() в момент сборки объекта, а не импорта файла!
    executed_at = factory.LazyFunction(lambda: datetime.now(UTC).isoformat())

    # Faker генерирует случайный осмысленный текст на русском языке (4 слова)
    comment = factory.Faker("sentence", nb_words=4, locale="ru_RU")

    @classmethod
    def build_json(cls, **kwargs: object) -> dict:
        """
        Собирает словарь, полностью безопасный для JSON-сериализации.

        Клиент httpx не умеет сериализовать тип Decimal "из коробки"
        (стандарт JSON не поддерживает Decimal). Этот метод-обертка гарантирует,
        что Decimal превратится в строку без потери финансовой точности.
        """
        # Сначала генерируем базовый словарь со случайными данными и переопределениями (kwargs)
        data = cls.build(**kwargs)

        # Защита от потери точности: конвертируем Decimal в str
        if isinstance(data.get("amount"), Decimal):
            data["amount"] = str(data["amount"])
        return data


class CategoryFactory(factory.Factory):
    """
    Генерирует словари для конструктора доменной модели Category.
    Используется в интеграционных тестах для подготовки (Seed) внешних ключей (FK).
    """

    class Meta:
        model = dict

    name = factory.Faker("word", locale="ru_RU")
    type = fuzzy.FuzzyChoice(["income", "expense"]) # Случайный выбор из списка

    # Генерируем случайный Hex-цвет (например, #FF5733)
    icon = factory.LazyFunction(
        lambda: f"#{factory.Faker('hex_color').evaluate(None, None, {'locale': None}).lstrip('#')}"
    )

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ПРИМЕР ИСПОЛЬЗОВАНИЯ В ТЕСТЕ
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# async def test_create_transaction(async_client):
#     # Генерируем данные, но жестко переопределяем (override) сумму на негативную
#     bad_payload = TransactionCreateFactory.build_json(amount="-500.00")
#
#     response = await async_client.post("/transactions", json=bad_payload)
#     assert response.status_code == 422 # Pydantic отклонит негативную сумму