from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class RecordCreate(BaseModel):
    amount: Decimal = Field(..., ge=0)
    type: Literal["income", "expense"]
    category: str = Field(..., min_length=1, max_length=100)
    date: date
    notes: Optional[str] = None


class RecordUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, ge=0)
    type: Optional[Literal["income", "expense"]] = None
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    date: Optional[date] = None
    notes: Optional[str] = None


class RecordResponse(BaseModel):
    id: int
    user_id: int
    amount: Decimal
    type: Literal["income", "expense"]
    category: str
    date: date
    notes: Optional[str] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class RecordFilter(BaseModel):
    type: Optional[Literal["income", "expense"]] = None
    category: Optional[str] = Field(default=None, min_length=1, max_length=100)
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
