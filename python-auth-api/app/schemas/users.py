from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.roles import Role


class UserPublic(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: Role
    created_at: datetime


class UserMe(UserPublic):
    pass


class AdminUsersOut(BaseModel):
    items: list[UserPublic]
    total: int


class PatientProfileOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: Role = Field(default=Role.PACIENTE)
    created_at: datetime
