from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class BudgetUpsert(BaseModel):
    category_id: int
    amount_limit: Decimal
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000)

    model_config = ConfigDict(from_attributes=True)
