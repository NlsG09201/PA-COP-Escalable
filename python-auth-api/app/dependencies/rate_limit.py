from __future__ import annotations

import hashlib
from fastapi import Depends, HTTPException, Request, status
from redis.asyncio import Redis

from app.core.config import settings
from app.db.redis import get_redis


def _client_id(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    raw = f"{ip}:{ua}".encode("utf-8", errors="ignore")
    return hashlib.sha256(raw).hexdigest()


def rate_limiter(redis: Redis, *, bucket: str):
    async def _dep(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return

        cid = _client_id(request)
        key = f"{settings.rate_limit_prefix}:{bucket}:{cid}"

        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, settings.rate_limit_window_seconds, nx=True)
        count, _ = await pipe.execute()

        if int(count) > settings.rate_limit_max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="rate_limit_exceeded",
            )

    return _dep


def rate_limit(bucket: str):
    async def _dep(request: Request, redis: Redis = Depends(get_redis)) -> None:
        await rate_limiter(redis, bucket=bucket)(request)

    return _dep

