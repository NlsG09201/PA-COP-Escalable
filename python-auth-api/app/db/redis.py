from __future__ import annotations

from redis.asyncio import Redis

from app.core.config import settings

_redis: Redis | None = None


async def connect_to_redis() -> None:
    global _redis
    if _redis is not None:
        return
    _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    await _redis.ping()


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
    _redis = None


def get_redis() -> Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized")
    return _redis

