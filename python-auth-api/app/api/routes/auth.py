from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis.asyncio import Redis

from app.core.security import create_access_token, create_refresh_token
from app.db.mongodb import get_db
from app.db.redis import get_redis
from app.models.roles import Role
from app.schemas.auth import LoginIn, LogoutOut, RegisterIn, TokenOut
from app.services.tokens import TokenStore, new_jti, safe_decode
from app.services.users import UsersService
from app.dependencies.rate_limit import rate_limit


router = APIRouter()
bearer = HTTPBearer(auto_error=False)


def _utc_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


@router.post(
    "/register",
    response_model=TokenOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: RegisterIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: None = Depends(rate_limit("register")),
):
    if body.role == Role.SUPERADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden_role")

    users = UsersService(db)
    try:
        created = await users.create_user(
            username=body.username,
            email=str(body.email),
            password=body.password,
            role=body.role,
        )
    except Exception as e:
        msg = str(e).lower()
        if "duplicate" in msg or "e11000" in msg:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="user_already_exists")
        if "invalid_username" in msg:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid_username")
        raise

    jti_access = new_jti()
    jti_refresh = new_jti()
    access, exp_access = create_access_token(subject=created["id"], role=str(created["role"]), jti=jti_access)
    refresh, exp_refresh = create_refresh_token(subject=created["id"], role=str(created["role"]), jti=jti_refresh)

    store = TokenStore(redis)
    await store.set_session(user_id=created["id"], refresh_jti=jti_refresh)

    return TokenOut(access_token=access, refresh_token=refresh, expires_at=exp_access)


@router.post("/login", response_model=TokenOut)
async def login(
    body: LoginIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
    redis: Redis = Depends(get_redis),
    _: None = Depends(rate_limit("login")),
):
    user = await UsersService(db).authenticate(username_or_email=body.username_or_email, password=body.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    jti_access = new_jti()
    jti_refresh = new_jti()
    access, exp_access = create_access_token(subject=user["id"], role=str(user["role"]), jti=jti_access)
    refresh, _ = create_refresh_token(subject=user["id"], role=str(user["role"]), jti=jti_refresh)

    store = TokenStore(redis)
    await store.set_session(user_id=user["id"], refresh_jti=jti_refresh)

    return TokenOut(access_token=access, refresh_token=refresh, expires_at=exp_access)


@router.post("/logout", response_model=LogoutOut)
async def logout(
    redis: Redis = Depends(get_redis),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_token")

    token = creds.credentials.strip()
    payload = safe_decode(token)
    if not payload or payload.get("jti") is None or payload.get("exp") is None or payload.get("sub") is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")

    ttl = int(payload["exp"]) - _utc_ts()
    store = TokenStore(redis)
    await store.blacklist_jti(jti=str(payload["jti"]), ttl_seconds=ttl)
    await store.clear_session(user_id=str(payload["sub"]))
    return LogoutOut(ok=True)

