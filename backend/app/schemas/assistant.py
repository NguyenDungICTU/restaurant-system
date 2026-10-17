from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DataKind = Literal["tables", "orders", "revenue", "dishes", "checkouts", "shift", "dish_trends", "cancellations", "wait_times", "busy_hours"]


class ComparisonRange(BaseModel):
    model_config = ConfigDict(extra="forbid")
    start: date
    end: date


class DataRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: DataKind
    start: date | None = None
    end: date | None = None
    compare_previous: bool = False
    comparison: ComparisonRange | None = None
    limit: int = Field(default=10, ge=1, le=10)


class HistoryMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(max_length=1500)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(default="", max_length=2000)
    page: str = Field(default="", max_length=50)
    guide_id: str | None = Field(default=None, max_length=60)
    data_request: DataRequest | None = None
    history: list[HistoryMessage] = Field(default_factory=list, max_length=8)
    # Filter context only, not facts or authorization. Always revalidate against server role.
    context: DataRequest | None = None

    @field_validator("question")
    @classmethod
    def strip_question(cls, value):
        return value.strip()
