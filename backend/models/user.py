from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    firebase_uid: str = Field(..., min_length=1, max_length=128)
    email: str = Field(..., min_length=1, max_length=255)
    name: str = Field(..., min_length=1, max_length=150)


class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    email: str
    name: str
    role: Literal["viewer", "analyst", "admin"]
    status: Literal["active", "inactive"]
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: Literal["viewer", "analyst", "admin"]


class UserStatusUpdate(BaseModel):
    status: Literal["active", "inactive"]
