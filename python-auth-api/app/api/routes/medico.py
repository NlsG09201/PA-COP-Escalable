from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.dependencies.auth import require_roles
from app.db.mongodb import get_db
from app.models.roles import Role
from app.services.users import UsersService


router = APIRouter()


@router.get("/pacientes")
async def medico_pacientes(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    _=Depends(require_roles(Role.MEDICO)),
):
    users = db.get_collection("users")
    cursor = (
        users.find({"role": str(Role.PACIENTE), "disabled": {"$ne": True}}, {"password_hash": 0})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    items = []
    async for u in cursor:
        items.append(
            {
                "id": str(u["_id"]),
                "username": u["username"],
                "email": u["email"],
                "role": u["role"],
                "created_at": u["created_at"],
            }
        )
    total = await users.count_documents({"role": str(Role.PACIENTE), "disabled": {"$ne": True}})
    return {"items": items, "total": total}

