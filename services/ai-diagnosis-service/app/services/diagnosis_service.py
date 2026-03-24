"""Core service that orchestrates image analysis, async jobs, and training workflows."""

from __future__ import annotations

import json
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from bson import ObjectId
from gridfs import GridFS
from pymongo.database import Database
from redis.asyncio import Redis

from app.config import Settings
from app.ml.model_loader import CLASS_DESCRIPTIONS, DENTAL_CLASSES, DentalModelLoader
from app.ml.preprocessing import preprocess_image
from app.models.schemas import (
    AsyncJobResponse,
    DiagnosisLabel,
    DiagnosisResponse,
    Finding,
    JobStatus,
    TrainRequest,
)

logger = logging.getLogger(__name__)


class DiagnosisService:
    """Facade over ML inference, persistence, and async job management."""

    def __init__(
        self,
        model_loader: DentalModelLoader,
        mongo_db: Database,
        gridfs_bucket: GridFS,
        redis_client: Redis,
        settings: Settings,
    ) -> None:
        self.model = model_loader
        self.db = mongo_db
        self.fs = gridfs_bucket
        self.redis = redis_client
        self.settings = settings

    # ------------------------------------------------------------------
    # Synchronous analysis
    # ------------------------------------------------------------------

    async def analyze_image(
        self,
        image_bytes: bytes,
        patient_id: Optional[str] = None,
    ) -> DiagnosisResponse:
        """Run CNN inference on *image_bytes* and persist the result.

        Returns a fully populated :class:`DiagnosisResponse`.
        """
        tensor = preprocess_image(image_bytes)
        predictions = self.model.predict(tensor)

        findings = self._build_findings(predictions)

        image_id = self.fs.put(
            image_bytes,
            filename=f"diagnosis_{uuid.uuid4().hex}.png",
            content_type="image/png",
        )

        job_id = uuid.uuid4().hex
        now = datetime.now(tz=timezone.utc)

        doc: Dict[str, Any] = {
            "job_id": job_id,
            "status": JobStatus.COMPLETED.value,
            "findings": [f.model_dump(mode="json") for f in findings],
            "image_id": str(image_id),
            "patient_id": patient_id,
            "analyzed_at": now,
            "model_version": self.model.model_version,
        }
        self.db["diagnosis_results"].insert_one(doc)

        return DiagnosisResponse(
            job_id=job_id,
            status=JobStatus.COMPLETED,
            findings=findings,
            image_id=str(image_id),
            patient_id=patient_id,
            analyzed_at=now,
            model_version=self.model.model_version,
        )

    # ------------------------------------------------------------------
    # Asynchronous (stream-backed) analysis
    # ------------------------------------------------------------------

    async def analyze_async(
        self,
        image_bytes: bytes,
        filename: str,
        patient_id: Optional[str] = None,
    ) -> AsyncJobResponse:
        """Store the image in GridFS, enqueue a job on the Redis stream, and return immediately."""
        image_id = self.fs.put(
            image_bytes,
            filename=filename,
            content_type="image/png",
        )

        job_id = uuid.uuid4().hex
        self.db["diagnosis_jobs"].insert_one(
            {
                "job_id": job_id,
                "image_id": str(image_id),
                "patient_id": patient_id,
                "status": JobStatus.QUEUED.value,
                "created_at": datetime.now(tz=timezone.utc),
            }
        )

        await self.redis.xadd(
            self.settings.STREAM_KEY_REQUESTS,
            {"job_id": job_id, "image_id": str(image_id), "patient_id": patient_id or ""},
        )
        logger.info("Job %s queued on stream %s.", job_id, self.settings.STREAM_KEY_REQUESTS)

        return AsyncJobResponse(job_id=job_id, status="QUEUED")

    async def get_result(self, job_id: str) -> Optional[DiagnosisResponse]:
        """Fetch a completed result or return ``None`` if still processing."""
        doc = self.db["diagnosis_results"].find_one({"job_id": job_id})
        if doc is not None:
            return DiagnosisResponse(
                job_id=doc["job_id"],
                status=JobStatus(doc["status"]),
                findings=[Finding(**f) for f in doc.get("findings", [])],
                image_id=doc.get("image_id", ""),
                patient_id=doc.get("patient_id"),
                analyzed_at=doc.get("analyzed_at", datetime.now(tz=timezone.utc)),
                model_version=doc.get("model_version", self.model.model_version),
            )

        job = self.db["diagnosis_jobs"].find_one({"job_id": job_id})
        if job is not None:
            return DiagnosisResponse(
                job_id=job_id,
                status=JobStatus(job.get("status", "PROCESSING")),
                findings=[],
                image_id=job.get("image_id", ""),
                patient_id=job.get("patient_id"),
                analyzed_at=job.get("created_at", datetime.now(tz=timezone.utc)),
                model_version=self.model.model_version,
            )
        return None

    async def process_stream_job(self, job_id: str) -> None:
        """Process a single job that was read from the Redis stream."""
        job = self.db["diagnosis_jobs"].find_one({"job_id": job_id})
        if job is None:
            logger.error("Job %s not found in diagnosis_jobs collection.", job_id)
            return

        self.db["diagnosis_jobs"].update_one(
            {"job_id": job_id},
            {"$set": {"status": JobStatus.PROCESSING.value}},
        )

        try:
            image_id = job["image_id"]
            grid_out = self.fs.get(ObjectId(image_id))
            image_bytes = grid_out.read()

            tensor = preprocess_image(image_bytes)
            predictions = self.model.predict(tensor)
            findings = self._build_findings(predictions)

            now = datetime.now(tz=timezone.utc)
            result_doc: Dict[str, Any] = {
                "job_id": job_id,
                "status": JobStatus.COMPLETED.value,
                "findings": [f.model_dump(mode="json") for f in findings],
                "image_id": image_id,
                "patient_id": job.get("patient_id"),
                "analyzed_at": now,
                "model_version": self.model.model_version,
            }
            self.db["diagnosis_results"].insert_one(result_doc)

            self.db["diagnosis_jobs"].update_one(
                {"job_id": job_id},
                {"$set": {"status": JobStatus.COMPLETED.value, "completed_at": now}},
            )

            await self.redis.xadd(
                self.settings.STREAM_KEY_RESULTS,
                {"job_id": job_id, "status": "COMPLETED"},
            )
            logger.info("Job %s completed successfully.", job_id)

        except Exception:
            logger.exception("Failed to process job %s.", job_id)
            self.db["diagnosis_jobs"].update_one(
                {"job_id": job_id},
                {"$set": {"status": JobStatus.FAILED.value}},
            )
            await self.redis.xadd(
                self.settings.STREAM_KEY_RESULTS,
                {"job_id": job_id, "status": "FAILED"},
            )

    # ------------------------------------------------------------------
    # Training data management
    # ------------------------------------------------------------------

    async def upload_training_data(
        self,
        files: List[tuple[str, bytes]],
        labels: Dict[str, str],
    ) -> Dict[str, Any]:
        """Persist training images and their labels into GridFS + MongoDB metadata."""
        stored: List[str] = []
        for filename, content in files:
            label = labels.get(filename, "UNKNOWN")
            fid = self.fs.put(
                content,
                filename=filename,
                content_type="image/png",
                metadata={"label": label, "dataset": "training"},
            )
            self.db["training_images"].insert_one(
                {
                    "file_id": str(fid),
                    "filename": filename,
                    "label": label,
                    "uploaded_at": datetime.now(tz=timezone.utc),
                }
            )
            stored.append(str(fid))

        logger.info("Stored %d training images.", len(stored))
        return {"stored_count": len(stored), "file_ids": stored}

    async def start_training(self, params: TrainRequest) -> Dict[str, str]:
        """Launch fine-tuning in a background thread so the request returns immediately."""
        run_id = uuid.uuid4().hex
        self.db["training_runs"].insert_one(
            {
                "run_id": run_id,
                "status": "STARTED",
                "params": params.model_dump(),
                "started_at": datetime.now(tz=timezone.utc),
            }
        )

        thread = threading.Thread(
            target=self._run_training,
            args=(run_id, params),
            daemon=True,
        )
        thread.start()
        logger.info("Training run %s started in background thread.", run_id)
        return {"run_id": run_id, "status": "STARTED"}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_findings(self, predictions: List[tuple[str, float]]) -> List[Finding]:
        """Convert raw predictions into :class:`Finding` objects above the confidence threshold."""
        findings: List[Finding] = []
        for label_str, confidence in predictions:
            if confidence < self.settings.CONFIDENCE_THRESHOLD:
                continue
            findings.append(
                Finding(
                    label=DiagnosisLabel(label_str),
                    confidence=round(confidence, 4),
                    description=CLASS_DESCRIPTIONS.get(label_str, ""),
                )
            )
        return findings

    def _run_training(self, run_id: str, params: TrainRequest) -> None:
        """Execute training synchronously inside a daemon thread."""
        try:
            from train.train_model import run_training_from_gridfs

            metrics = run_training_from_gridfs(
                db=self.db,
                gridfs_bucket=self.fs,
                model_path=self.settings.MODEL_PATH,
                epochs=params.epochs,
                lr=params.learning_rate,
                batch_size=params.batch_size,
            )
            self.db["training_runs"].update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "COMPLETED",
                        "metrics": metrics,
                        "completed_at": datetime.now(tz=timezone.utc),
                    }
                },
            )
            self.model.load()
            logger.info("Training run %s completed. Model reloaded.", run_id)

        except Exception:
            logger.exception("Training run %s failed.", run_id)
            self.db["training_runs"].update_one(
                {"run_id": run_id},
                {
                    "$set": {
                        "status": "FAILED",
                        "completed_at": datetime.now(tz=timezone.utc),
                    }
                },
            )
