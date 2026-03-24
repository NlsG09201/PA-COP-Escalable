"""Redis Stream consumer that processes async emotion-analysis jobs."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from redis.asyncio import Redis
from redis.exceptions import ResponseError

from app.config import settings

if TYPE_CHECKING:
    from app.services.emotion_service import EmotionService

logger = logging.getLogger(__name__)


async def ensure_consumer_group(redis: Redis) -> None:
    """Create the consumer group (idempotent)."""
    try:
        await redis.xgroup_create(
            name=settings.STREAM_KEY_REQUESTS,
            groupname=settings.CONSUMER_GROUP,
            id="0",
            mkstream=True,
        )
        logger.info(
            "Created consumer group '%s' on '%s'",
            settings.CONSUMER_GROUP,
            settings.STREAM_KEY_REQUESTS,
        )
    except ResponseError as exc:
        if "BUSYGROUP" in str(exc):
            logger.debug("Consumer group already exists")
        else:
            raise


async def run_consumer(
    redis: Redis,
    emotion_service: EmotionService,
    *,
    stop_event: asyncio.Event | None = None,
) -> None:
    """Poll the Redis Stream in a loop and process incoming jobs.

    Stops gracefully when *stop_event* is set or when the task is cancelled.
    """
    await ensure_consumer_group(redis)
    logger.info(
        "Starting Redis Stream consumer group=%s consumer=%s stream=%s",
        settings.CONSUMER_GROUP,
        settings.CONSUMER_NAME,
        settings.STREAM_KEY_REQUESTS,
    )

    while True:
        if stop_event and stop_event.is_set():
            logger.info("Stop event received – shutting down consumer")
            break

        try:
            messages = await redis.xreadgroup(
                groupname=settings.CONSUMER_GROUP,
                consumername=settings.CONSUMER_NAME,
                streams={settings.STREAM_KEY_REQUESTS: ">"},
                count=settings.BATCH_SIZE,
                block=settings.POLL_INTERVAL_MS,
            )
        except asyncio.CancelledError:
            logger.info("Consumer task cancelled")
            break
        except Exception:
            logger.exception("Error reading from stream – retrying in 2 s")
            await asyncio.sleep(2)
            continue

        if not messages:
            continue

        for _stream_name, entries in messages:
            for msg_id, fields in entries:
                job_id = _decode(fields.get(b"job_id", fields.get("job_id", b"")))
                if not job_id:
                    logger.warning("Skipping message %s – no job_id", msg_id)
                    await _ack(redis, msg_id)
                    continue

                logger.info("Processing stream job=%s msg=%s", job_id, msg_id)
                try:
                    await emotion_service.process_stream_job(job_id)
                except Exception:
                    logger.exception("Failed to process job=%s", job_id)
                finally:
                    await _ack(redis, msg_id)

    logger.info("Consumer loop exited")


async def _ack(redis: Redis, msg_id: bytes | str) -> None:
    try:
        await redis.xack(
            settings.STREAM_KEY_REQUESTS,
            settings.CONSUMER_GROUP,
            msg_id,
        )
    except Exception:
        logger.warning("Failed to ACK message %s", msg_id, exc_info=True)


def _decode(value: bytes | str) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)
