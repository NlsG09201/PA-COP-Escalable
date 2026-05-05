from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.api.routes.admin import router as admin_router
from app.api.routes.medico import router as medico_router
from app.api.routes.paciente import router as paciente_router
from app.core.config import settings
from app.db.mongodb import connect_to_mongo, close_mongo
from app.db.redis import connect_to_redis, close_redis


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.env != "prod" else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def _startup() -> None:
        await connect_to_mongo()
        await connect_to_redis()

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        await close_redis()
        await close_mongo()

    app.include_router(auth_router, prefix="/auth", tags=["auth"])
    app.include_router(users_router, prefix="/users", tags=["users"])
    app.include_router(admin_router, prefix="/admin", tags=["admin"])
    app.include_router(medico_router, prefix="/medico", tags=["medico"])
    app.include_router(paciente_router, prefix="/paciente", tags=["paciente"])

    return app


app = create_app()
