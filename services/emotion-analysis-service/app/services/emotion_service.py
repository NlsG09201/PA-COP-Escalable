"""Core service orchestrating audio emotion analysis."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import gridfs
import numpy as np
from pymongo.database import Database
from redis.asyncio import Redis

from app.config import settings
from app.ml.audio_preprocessing import (
    extract_prosody,
    load_audio,
    normalize_audio,
    trim_silence,
)
from app.ml.model_loader import EmotionModelLoader
from app.models.schemas import (
    AsyncJobResponse,
    EmotionAnalysisResponse,
    EmotionLabel,
    EmotionPrediction,
    ProsodyFeatures,
)

logger = logging.getLogger(__name__)

COLLECTION = "emotion_results"


class EmotionService:
    """Stateful service – one instance lives for the app lifetime."""

    def __init__(
        self,
        model_loader: EmotionModelLoader,
        db: Database,
        redis: Redis,
    ):
        self._model = model_loader
        self._db = db
        self._redis = redis
        self._fs = gridfs.GridFS(db)

    async def analyze_audio(
        self,
        audio_bytes: bytes,
        content_type: str,
        patient_id: Optional[str] = None,
    ) -> EmotionAnalysisResponse:
        """Full synchronous pipeline: decode -> embed -> classify -> store."""
        job_id = str(uuid.uuid4())
        logger.info("Analyzing audio job=%s content_type=%s", job_id, content_type)

        audio_np, sr = load_audio(audio_bytes, content_type, target_sr=settings.SAMPLE_RATE)
        audio_duration_sec = float(len(audio_np) / sr)

        if audio_duration_sec > settings.MAX_AUDIO_DURATION_SEC:
            raise ValueError(
                f"Audio duration {audio_duration_sec:.1f}s exceeds "
                f"limit of {settings.MAX_AUDIO_DURATION_SEC}s"
            )

        audio_np = normalize_audio(audio_np)
        audio_np = trim_silence(audio_np, sr)

        embeddings = self._model.extract_embeddings(audio_np, sr)

        prosody_dict = extract_prosody(audio_np, sr)
        prosody = ProsodyFeatures(**prosody_dict)

        raw_preds = self._model.predict(embeddings)
        all_emotions = [
            EmotionPrediction(label=EmotionLabel(lbl), confidence=round(conf, 4))
            for lbl, conf in raw_preds
        ]
        primary_emotion = all_emotions[0]

        result = EmotionAnalysisResponse(
            job_id=job_id,
            status="completed",
            primary_emotion=primary_emotion,
            all_emotions=all_emotions,
            prosody=prosody,
            audio_duration_sec=round(audio_duration_sec, 3),
            patient_id=patient_id,
            analyzed_at=datetime.now(timezone.utc),
        )

        self._store_result(result)
        logger.info(
            "Analysis complete job=%s emotion=%s conf=%.3f",
            job_id,
            primary_emotion.label.value,
            primary_emotion.confidence,
        )
        return result

    async def analyze_async(
        self,
        audio_bytes: bytes,
        filename: str,
        content_type: str,
        patient_id: Optional[str] = None,
    ) -> AsyncJobResponse:
        """Store audio in GridFS and publish a job to the Redis Stream."""
        job_id = str(uuid.uuid4())

        grid_id = self._fs.put(
            audio_bytes,
            filename=filename,
            content_type=content_type,
            metadata={"job_id": job_id, "patient_id": patient_id},
        )

        self._db[COLLECTION].insert_one(
            {
                "_id": job_id,
                "status": "pending",
                "grid_id": str(grid_id),
                "patient_id": patient_id,
                "content_type": content_type,
                "created_at": datetime.now(timezone.utc),
            }
        )

        await self._redis.xadd(
            settings.STREAM_KEY_REQUESTS,
            {
                "job_id": job_id,
                "grid_id": str(grid_id),
                "content_type": content_type,
                "patient_id": patient_id or "",
            },
        )
        logger.info("Async job published job=%s grid_id=%s", job_id, grid_id)
        return AsyncJobResponse(job_id=job_id, status="pending")

    async def get_result(self, job_id: str) -> dict[str, Any] | None:
        """Fetch a stored result from MongoDB."""
        doc = self._db[COLLECTION].find_one({"_id": job_id})
        if doc is None:
            return None
        doc.pop("_id", None)
        doc["job_id"] = job_id
        return _serialise_doc(doc)

    async def process_stream_job(self, job_id: str) -> None:
        """Load audio from GridFS, analyse and update result in MongoDB."""
        doc = self._db[COLLECTION].find_one({"_id": job_id})
        if doc is None:
            logger.error("Job %s not found in MongoDB", job_id)
            return

        grid_id = doc.get("grid_id")
        content_type = doc.get("content_type", "audio/wav")
        patient_id = doc.get("patient_id")

        try:
            from bson import ObjectId

            grid_file = self._fs.get(ObjectId(grid_id))
            audio_bytes = grid_file.read()
        except Exception:
            logger.exception("Failed to load GridFS file for job %s", job_id)
            self._db[COLLECTION].update_one(
                {"_id": job_id},
                {"$set": {"status": "failed", "error": "GridFS read error"}},
            )
            return

        try:
            result = await self.analyze_audio(audio_bytes, content_type, patient_id)
            update: dict[str, Any] = result.model_dump(mode="json")
            update["status"] = "completed"
            self._db[COLLECTION].update_one({"_id": job_id}, {"$set": update})

            await self._redis.xadd(
                settings.STREAM_KEY_RESULTS,
                {"job_id": job_id, "status": "completed"},
            )
            logger.info("Stream job completed job=%s", job_id)

        except Exception:
            logger.exception("Stream job failed job=%s", job_id)
            self._db[COLLECTION].update_one(
                {"_id": job_id},
                {"$set": {"status": "failed", "error": "Analysis error"}},
            )
            await self._redis.xadd(
                settings.STREAM_KEY_RESULTS,
                {"job_id": job_id, "status": "failed"},
            )

    def _store_result(self, result: EmotionAnalysisResponse) -> None:
        doc = result.model_dump(mode="json")
        doc["_id"] = result.job_id
        self._db[COLLECTION].replace_one(
            {"_id": result.job_id},
            doc,
            upsert=True,
        )


def _serialise_doc(doc: dict) -> dict:
    """Make a MongoDB document JSON-safe."""
    for key, val in doc.items():
        if isinstance(val, datetime):
            doc[key] = val.isoformat()
        elif hasattr(val, "__str__") and type(val).__name__ == "ObjectId":
            doc[key] = str(val)
    return doc
