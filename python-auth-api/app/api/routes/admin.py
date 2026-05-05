from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.mongodb import get_db
from app.dependencies.auth import require_roles
from app.models.roles import Role
from app.schemas.users import AdminUsersOut
from app.services.users import UsersService


router = APIRouter()


@router.get("/users", response_model=AdminUsersOut)
async def list_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_roles(Role.SUPERADMIN)),
):
    items, total = await UsersService(db).list_users(limit=limit, offset=offset)
    mapped = [
        {
            "id": u["id"],
            "username": u["username"],
            "email": u["email"],
            "role": Role(u["role"]),
            "created_at": u["created_at"],
        }
        for u in items
    ]
    return {"items": mapped, "total": total}

