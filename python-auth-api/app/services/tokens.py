from __future__ import annotations

import secrets
from typing import Any

from jose import JWTError, jwt
from redis.asyncio import Redis

from app.core.config import settings


def new_jti() -> str:
    return secrets.token_urlsafe(32)


def decode_jwt(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])


class TokenStore:
    def __init__(self, redis: Redis):
        self._redis = redis

    def _bl_key(self, jti: str) -> str:
        return f"{settings.token_blacklist_prefix}:{jti}"

    def _sess_key(self, user_id: str) -> str:
        return f"{settings.session_prefix}:{user_id}"

    async def blacklist_jti(self, *, jti: str, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            ttl_seconds = 1
        await self._redis.set(self._bl_key(jti), "1", ex=ttl_seconds)

    async def is_blacklisted(self, *, jti: str) -> bool:
        return await self._redis.exists(self._bl_key(jti)) == 1

    async def set_session(self, *, user_id: str, refresh_jti: str) -> None:
        await self._redis.set(self._sess_key(user_id), refresh_jti, ex=settings.session_ttl_seconds)

    async def get_session_refresh_jti(self, *, user_id: str) -> str | None:
        return await self._redis.get(self._sess_key(user_id))

    async def clear_session(self, *, user_id: str) -> None:
        await self._redis.delete(self._sess_key(user_id))


def safe_decode(token: str) -> dict[str, Any] | None:
    try:
        return decode_jwt(token)
    except JWTError:
        return None
