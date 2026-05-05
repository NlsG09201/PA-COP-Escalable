from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user, require_roles
from app.models.roles import Role
from app.schemas.users import PatientProfileOut


router = APIRouter()


@router.get("/perfil", response_model=PatientProfileOut)
async def paciente_perfil(
    user=Depends(get_current_user),
    _=Depends(require_roles(Role.PACIENTE)),
):
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"],
    }

