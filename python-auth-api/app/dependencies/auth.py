from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis.asyncio import Redis

from app.core.config import settings
from app.db.mongodb import get_db
from app.db.redis import get_redis
from app.models.roles import Role
from app.services.tokens import TokenStore, safe_decode
from app.services.users import UsersService


bearer_scheme = HTTPBearer(auto_error=False)


def _utc_now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _require_payload(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token_type")
    sub = payload.get("sub")
    role = payload.get("role")
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not (sub and role and jti and exp):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token_claims")
    if int(exp) <= _utc_now_ts():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token_expired")
    return payload


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
    redis: Redis = Depends(get_redis),
) -> dict[str, Any]:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_token")

    token = creds.credentials.strip()
    payload = _require_payload(safe_decode(token))

    store = TokenStore(redis)
    if await store.is_blacklisted(jti=str(payload["jti"])):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="token_revoked")

    user = await UsersService(db).get_by_id(str(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_not_found")
    if user.get("disabled") is True:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_disabled")

    user["role"] = Role(user["role"])
    user["_token_payload"] = payload
    user["_access_token"] = token
    return user


def require_roles(*allowed: Role):
    async def _dep(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        role = user.get("role")
        if role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
        return user

    return _dep

