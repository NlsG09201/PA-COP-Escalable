from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any

from app.config import settings
from app.models.schemas import (
    ClinicalRecommendationRequest,
    RelapsePredictionRequest,
)
from app.services.recommendation_service import RecommendationService
from app.services.relapse_service import RelapseService

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger("recommendation-engine.redis_consumer")


class RedisStreamConsumer:
    """Consumes recommendation / relapse requests from a Redis Stream and
    publishes results back to a results stream."""

    def __init__(self, app: FastAPI) -> None:
        self._app = app

    async def run(self) -> None:
        redis = self._app.state.redis
        group = settings.CONSUMER_GROUP
        consumer = settings.CONSUMER_NAME
        stream_key = settings.STREAM_KEY_REQUESTS
        results_key = settings.STREAM_KEY_RESULTS

        try:
            await redis.xgroup_create(stream_key, group, id="0", mkstream=True)
            logger.info("Created consumer group '%s' on stream '%s'", group, stream_key)
        except Exception:
            logger.debug("Consumer group '%s' may already exist", group)

        logger.info("Redis Stream consumer started — polling '%s'", stream_key)

        while True:
            try:
                messages = await redis.xreadgroup(
                    groupname=group,
                    consumername=consumer,
                    streams={stream_key: ">"},
                    count=settings.BATCH_SIZE,
                    block=settings.POLL_INTERVAL_MS,
                )

                if not messages:
                    continue

                for _stream_name, entries in messages:
                    for msg_id, fields in entries:
                        await self._process_message(msg_id, fields, redis, stream_key, results_key)

            except asyncio.CancelledError:
                logger.info("Redis Stream consumer shutting down")
                raise
            except Exception:
                logger.exception("Error in Redis Stream consumer loop")
                await asyncio.sleep(5)

    async def _process_message(
        self,
        msg_id: str,
        fields: dict[str, Any],
        redis: Any,
        stream_key: str,
        results_key: str,
    ) -> None:
        request_type = fields.get("type", "recommendation")
        payload_raw = fields.get("payload", "{}")

        try:
            payload = json.loads(payload_raw) if isinstance(payload_raw, str) else payload_raw
        except json.JSONDecodeError:
            logger.error("Invalid JSON payload in message %s", msg_id)
            await redis.xack(stream_key, settings.CONSUMER_GROUP, msg_id)
            return

        try:
            if request_type == "relapse":
                result = await self._handle_relapse(payload)
            else:
                result = await self._handle_recommendation(payload)

            await redis.xadd(results_key, {
                "request_id": msg_id,
                "type": request_type,
                "status": "completed",
                "result": json.dumps(result),
            })
        except Exception:
            logger.exception("Failed to process message %s", msg_id)
            await redis.xadd(results_key, {
                "request_id": msg_id,
                "type": request_type,
                "status": "error",
                "result": json.dumps({"error": "Processing failed"}),
            })
        finally:
            await redis.xack(stream_key, settings.CONSUMER_GROUP, msg_id)

    async def _handle_recommendation(self, payload: dict[str, Any]) -> dict[str, Any]:
        req = ClinicalRecommendationRequest(**payload)
        svc = RecommendationService(
            model_loader=self._app.state.model_loader,
            mongo_db=getattr(self._app.state, "mongo", None),
        )
        response = svc.recommend_clinical(req)
        return response.model_dump()

    async def _handle_relapse(self, payload: dict[str, Any]) -> dict[str, Any]:
        req = RelapsePredictionRequest(**payload)
        svc = RelapseService(
            model_loader=self._app.state.model_loader,
            mongo_db=getattr(self._app.state, "mongo", None),
        )
        response = svc.predict_relapse(req)
        return response.model_dump()
