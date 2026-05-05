from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db
    if _client is not None:
        return
    _client = AsyncIOMotorClient(settings.mongodb_uri, uuidRepresentation="standard")
    _db = _client[settings.mongodb_db]

    users = _db.get_collection("users")
    await users.create_index("email", unique=True)
    await users.create_index("username", unique=True)


async def close_mongo() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not initialized")
    return _db

