from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.ml.model_loader import ModelLoader
from app.routers import health, recommendations, relapse
from app.services.redis_consumer import RedisStreamConsumer

logger = logging.getLogger("recommendation-engine")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    logger.info("Starting recommendation-engine lifespan …")

    loader = ModelLoader(
        relapse_path=settings.RELAPSE_MODEL_PATH,
        recommendation_path=settings.RECOMMENDATION_MODEL_PATH,
    )
    loader.load_relapse_model()
    loader.load_recommendation_model()
    application.state.model_loader = loader

    # --- Redis -----------------------------------------------------------
    import redis.asyncio as aioredis

    redis_pool = aioredis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        decode_responses=True,
    )
    application.state.redis = redis_pool

    # --- MongoDB ---------------------------------------------------------
    from pymongo import MongoClient

    mongo_client = MongoClient(settings.MONGODB_URI)
    mongo_db = mongo_client[settings.MONGODB_DB]
    application.state.mongo = mongo_db

    # --- PostgreSQL ------------------------------------------------------
    import psycopg2
    from psycopg2.extras import RealDictCursor

    try:
        pg_conn = psycopg2.connect(settings.POSTGRES_URL, cursor_factory=RealDictCursor)
        pg_conn.autocommit = True
        application.state.pg = pg_conn
        logger.info("PostgreSQL connection established")
    except Exception:
        logger.warning("PostgreSQL unavailable – running without relational data", exc_info=True)
        application.state.pg = None

    # --- Redis Stream consumer (background) ------------------------------
    consumer = RedisStreamConsumer(application)
    consumer_task = asyncio.create_task(consumer.run())
    application.state.consumer_task = consumer_task

    logger.info("Recommendation-engine ready")
    yield

    # --- Shutdown --------------------------------------------------------
    consumer_task.cancel()
    try:
        await consumer_task
    except asyncio.CancelledError:
        pass

    await redis_pool.aclose()
    mongo_client.close()
    if application.state.pg is not None:
        application.state.pg.close()
    logger.info("Recommendation-engine shut down cleanly")


app = FastAPI(
    title="COP Recommendation Engine",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(recommendations.router)
app.include_router(relapse.router)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def generic_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
