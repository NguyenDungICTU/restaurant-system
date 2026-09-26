from datetime import datetime

from pydantic import BaseModel, Field


class OrderCreate(BaseModel):
    table_id: int = Field(gt=0)


class OrderItemCreate(BaseModel):
    dish_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=100)


class OrderStatusUpdate(BaseModel):
    status: str = Field(min_length=1, max_length=30)


class OrderItemResponse(BaseModel):
    id: int
    dish_id: int
    dish_name: str
    unit_price: int
    quantity: int
    total: int


class OrderResponse(BaseModel):
    id: int
    table_id: int
    created_by: int
    status: str
    created_at: datetime
    items: list[OrderItemResponse]
    total: int
