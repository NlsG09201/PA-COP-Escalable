from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import hash_password, verify_password
from app.models.roles import Role


_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,50}$")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _oid_to_str(doc: dict[str, Any]) -> dict[str, Any]:
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d["_id"])
        d.pop("_id", None)
    return d


class UsersService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self._users = db.get_collection("users")

    async def create_user(self, *, username: str, email: str, password: str, role: Role) -> dict[str, Any]:
        username = username.strip()
        email = email.strip().lower()
        if not _USERNAME_RE.fullmatch(username):
            raise ValueError("invalid_username")

        doc = {
            "username": username,
            "email": email,
            "password_hash": hash_password(password),
            "role": str(role),
            "created_at": _utcnow(),
            "disabled": False,
        }

        try:
            result = await self._users.insert_one(doc)
        except Exception as e:  # pragma: no cover
            # Duplicate key errors will be mapped by API layer.
            raise e
        created = await self._users.find_one({"_id": result.inserted_id})
        if not created:
            raise RuntimeError("user_create_failed")
        return _oid_to_str(created)

    async def authenticate(self, *, username_or_email: str, password: str) -> dict[str, Any] | None:
        key = username_or_email.strip()
        q = {"email": key.lower()} if "@" in key else {"username": key}
        user = await self._users.find_one(q)
        if not user:
            return None
        if user.get("disabled") is True:
            return None
        if not verify_password(password, user.get("password_hash", "")):
            return None
        return _oid_to_str(user)

    async def get_by_id(self, user_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(user_id):
            return None
        user = await self._users.find_one({"_id": ObjectId(user_id)})
        return _oid_to_str(user) if user else None

    async def list_users(self, *, limit: int = 50, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        cursor = self._users.find({}, {"password_hash": 0}).sort("created_at", -1).skip(offset).limit(limit)
        items = [_oid_to_str(u) async for u in cursor]
        total = await self._users.count_documents({})
        return items, total
