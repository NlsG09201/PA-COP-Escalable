"""Background Redis Stream consumer that processes queued diagnosis jobs."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from redis.asyncio import Redis
from redis.exceptions import ResponseError

if TYPE_CHECKING:
    from app.services.diagnosis_service import DiagnosisService

logger = logging.getLogger(__name__)


class RedisStreamConsumer:
    """Continuously polls the diagnosis request stream and dispatches work.

    Designed to run as a long-lived ``asyncio.Task`` created during the
    FastAPI lifespan.
    """

    def __init__(
        self,
        redis_client: Redis,
        diagnosis_service: DiagnosisService,
        stream_key: str,
        group_name: str,
        consumer_name: str,
        batch_size: int = 10,
        poll_interval_ms: int = 1000,
    ) -> None:
        self.redis = redis_client
        self.diagnosis_service = diagnosis_service
        self.stream_key = stream_key
        self.group_name = group_name
        self.consumer_name = consumer_name
        self.batch_size = batch_size
        self.poll_interval_ms = poll_interval_ms
        self._running = False

    async def setup_consumer_group(self) -> None:
        """Ensure the consumer group exists, creating the stream if necessary."""
        try:
            await self.redis.xgroup_create(
                self.stream_key,
                self.group_name,
                id="0",
                mkstream=True,
            )
            logger.info(
                "Consumer group '%s' created on stream '%s'.",
                self.group_name,
                self.stream_key,
            )
        except ResponseError as exc:
            if "BUSYGROUP" in str(exc):
                logger.debug("Consumer group '%s' already exists.", self.group_name)
            else:
                raise

    async def start(self) -> None:
        """Main loop — reads messages, processes them, and acknowledges."""
        await self.setup_consumer_group()
        self._running = True
        logger.info(
            "Stream consumer '%s' started (group=%s, stream=%s).",
            self.consumer_name,
            self.group_name,
            self.stream_key,
        )

        while self._running:
            try:
                messages = await self.redis.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams={self.stream_key: ">"},
                    count=self.batch_size,
                    block=self.poll_interval_ms,
                )

                if not messages:
                    continue

                for _stream_name, entries in messages:
                    for msg_id, data in entries:
                        await self._handle_message(msg_id, data)

            except asyncio.CancelledError:
                logger.info("Consumer '%s' cancelled — shutting down.", self.consumer_name)
                break
            except Exception:
                logger.exception("Unexpected error in consumer loop — retrying in 5 s.")
                await asyncio.sleep(5)

        self._running = False
        logger.info("Consumer '%s' stopped.", self.consumer_name)

    async def stop(self) -> None:
        """Signal the consumer loop to exit gracefully."""
        self._running = False

    async def _handle_message(self, msg_id: bytes, data: dict) -> None:
        """Process a single stream message and acknowledge it."""
        job_id = data.get(b"job_id") or data.get("job_id")
        if isinstance(job_id, bytes):
            job_id = job_id.decode()

        if not job_id:
            logger.warning("Received message without job_id: %s", data)
            await self.redis.xack(self.stream_key, self.group_name, msg_id)
            return

        logger.info("Processing job %s (msg_id=%s).", job_id, msg_id)
        try:
            await self.diagnosis_service.process_stream_job(job_id)
        except Exception:
            logger.exception("Error processing job %s.", job_id)
        finally:
            await self.redis.xack(self.stream_key, self.group_name, msg_id)
