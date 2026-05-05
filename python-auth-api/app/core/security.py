from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password, rounds=settings.security_password_bcrypt_rounds)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(*, subject: str, role: str, jti: str) -> tuple[str, int]:
    expire = _now_utc() + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "jti": jti,
        "iat": int(_now_utc().timestamp()),
        "exp": int(expire.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)
    return token, int(expire.timestamp())


def create_refresh_token(*, subject: str, role: str, jti: str) -> tuple[str, int]:
    expire = _now_utc() + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "refresh",
        "jti": jti,
        "iat": int(_now_utc().timestamp()),
        "exp": int(expire.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)
    return token, int(expire.timestamp())

