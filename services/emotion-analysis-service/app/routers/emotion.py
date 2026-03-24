"""Emotion analysis REST endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.ml.model_loader import EMOTION_CLASSES
from app.models.schemas import AsyncJobResponse, EmotionAnalysisResponse, ModelInfo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/emotion", tags=["emotion"])

_ALLOWED_CONTENT_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/webm",
    "audio/flac",
}


def _emotion_service(request: Request):
    svc = getattr(request.app.state, "emotion_service", None)
    if svc is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    return svc


@router.post("/analyze-audio", response_model=EmotionAnalysisResponse)
async def analyze_audio(
    request: Request,
    audio: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
):
    """Synchronous audio emotion analysis."""
    content_type = audio.content_type or "audio/wav"
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type: {content_type}. "
            f"Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    svc = _emotion_service(request)
    try:
        result = await svc.analyze_audio(audio_bytes, content_type, patient_id)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        logger.exception("analyze_audio failed")
        raise HTTPException(status_code=500, detail="Internal analysis error")


@router.post("/analyze-audio-async", response_model=AsyncJobResponse)
async def analyze_audio_async(
    request: Request,
    audio: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
):
    """Asynchronous audio analysis – stores in GridFS and publishes to Redis Stream."""
    content_type = audio.content_type or "audio/wav"
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio type: {content_type}",
        )

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    svc = _emotion_service(request)
    try:
        resp = await svc.analyze_async(
            audio_bytes,
            filename=audio.filename or "upload.wav",
            content_type=content_type,
            patient_id=patient_id,
        )
        return resp
    except Exception:
        logger.exception("analyze_audio_async failed")
        raise HTTPException(status_code=500, detail="Failed to enqueue job")


@router.get("/results/{job_id}")
async def get_result(request: Request, job_id: str):
    """Fetch an analysis result by job ID."""
    svc = _emotion_service(request)
    result = await svc.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return result


@router.post("/train/upload")
async def train_upload(
    request: Request,
    dataset: UploadFile = File(...),
):
    """Upload a labelled audio dataset (ZIP with wav files + labels.csv)."""
    import os
    import shutil
    import tempfile
    import zipfile

    content = await dataset.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty dataset file")

    tmp_dir = tempfile.mkdtemp(prefix="emotion_train_")
    zip_path = os.path.join(tmp_dir, "dataset.zip")

    try:
        with open(zip_path, "wb") as f:
            f.write(content)

        if not zipfile.is_zipfile(zip_path):
            raise HTTPException(status_code=400, detail="File is not a valid ZIP archive")

        extract_dir = os.path.join(tmp_dir, "extracted")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

        dest = os.path.join("train", "dataset")
        os.makedirs(dest, exist_ok=True)
        for item in os.listdir(extract_dir):
            src = os.path.join(extract_dir, item)
            dst = os.path.join(dest, item)
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
            else:
                shutil.copy2(src, dst)

        return {"status": "uploaded", "path": dest}
    except HTTPException:
        raise
    except Exception:
        logger.exception("train_upload failed")
        raise HTTPException(status_code=500, detail="Failed to process dataset")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/train/start")
async def train_start(request: Request):
    """Kick off model fine-tuning in a background thread."""
    import subprocess
    import sys

    data_dir = "train/dataset"
    if not os.path.isdir(data_dir):
        raise HTTPException(status_code=400, detail="No dataset found. Upload one first.")

    import os

    labels_csv = os.path.join(data_dir, "labels.csv")
    if not os.path.isfile(labels_csv):
        raise HTTPException(status_code=400, detail="labels.csv not found in dataset")

    try:
        proc = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "train.train_model",
                "--data-dir",
                data_dir,
                "--epochs",
                "30",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        return {
            "status": "training_started",
            "pid": proc.pid,
            "message": "Training started in background. Monitor logs for progress.",
        }
    except Exception:
        logger.exception("train_start failed")
        raise HTTPException(status_code=500, detail="Failed to start training")


@router.get("/model/info", response_model=ModelInfo)
async def model_info(request: Request):
    """Return metadata about the loaded model."""
    loader = getattr(request.app.state, "model_loader", None)
    db = getattr(request.app.state, "mongo_db", None)

    last_trained = None
    accuracy = None
    if db is not None:
        meta = db["emotion_model_meta"].find_one(sort=[("trained_at", -1)])
        if meta:
            last_trained = str(meta.get("trained_at", ""))
            accuracy = meta.get("accuracy")

    return ModelInfo(
        version="1.0.0",
        accuracy=accuracy,
        classes=EMOTION_CLASSES,
        last_trained=last_trained,
        wav2vec_model=loader._wav2vec_model_name if loader else "unknown",
        device=loader.device if loader else "cpu",
    )
