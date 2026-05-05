from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

from app.models.roles import Role


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role


class LoginIn(BaseModel):
    username_or_email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_at: int


class LogoutOut(BaseModel):
    ok: bool = True

