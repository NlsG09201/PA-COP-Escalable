from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from celery.result import AsyncResult
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.celery_app import celery_app
from app.core.logging import configure_logging
from app.core.settings import settings
from app.models import JobEnqueuedResponse, JobStatusResponse, OutputFormat
from app.storage.factory import create_storage

logger = logging.getLogger(__name__)

configure_logging(settings.log_level)

app = FastAPI(title=settings.service_name, version="1.0.0")

if settings.cors_allow_origins.strip():
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()],
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.service_name}


def _validate_upload(file: UploadFile) -> None:
    ct = (file.content_type or "").lower().strip()
    if ct not in ("image/jpeg", "image/jpg", "image/png"):
        raise HTTPException(status_code=415, detail=f"Unsupported content-type: {ct}")


def _tmp_dir() -> Path:
    p = Path(os.environ.get("TMPDIR", "/tmp")) / "img3d"
    p.mkdir(parents=True, exist_ok=True)
    return p


@app.post("/reconstruct-3d", response_model=JobEnqueuedResponse)
async def reconstruct_3d(
    file: UploadFile = File(...),
    output_format: OutputFormat = Form(default=settings.out_format),
    make_mesh: bool = Form(default=settings.make_mesh_default),
    fx: float | None = Form(default=None),
    fy: float | None = Form(default=None),
    cx: float | None = Form(default=None),
    cy: float | None = Form(default=None),
    depth_scale: float = Form(default=1.0),
    depth_offset: float = Form(default=0.0),
) -> JobEnqueuedResponse:
    _validate_upload(file)

    suffix = ".png" if (file.content_type or "").lower().endswith("png") else ".jpg"
    tmp_path = _tmp_dir() / f"{uuid.uuid4()}{suffix}"
    data = await file.read()
    if not data or len(data) < 32:
        raise HTTPException(status_code=400, detail="Empty upload")
    tmp_path.write_bytes(data)

    job = celery_app.send_task(
        "reconstruct_3d",
        kwargs={
            "image_path": str(tmp_path),
            "output_format": str(output_format),
            "make_mesh": bool(make_mesh),
            "fx": fx,
            "fy": fy,
            "cx": cx,
            "cy": cy,
            "depth_scale": float(depth_scale),
            "depth_offset": float(depth_offset),
        },
    )

    logger.info("job_enqueued", extra={"job_id": job.id, "fmt": output_format, "make_mesh": make_mesh})
    return JobEnqueuedResponse(job_id=str(job.id), status="QUEUED")


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str) -> JobStatusResponse:
    res = AsyncResult(job_id, app=celery_app)
    status = res.state
    if status == "FAILURE":
        err = str(res.result) if res.result is not None else "failed"
        return JobStatusResponse(job_id=job_id, status=status, error=err, meta={})
    if status == "SUCCESS":
        payload = res.result or {}
        model_id = payload.get("model_id")
        object_key = payload.get("object_key")
        dl = payload.get("download_url")
        meta = payload.get("meta") or {}
        return JobStatusResponse(job_id=job_id, status=status, model_id=model_id, download_url=dl, meta=meta)
    meta = res.info if isinstance(res.info, dict) else {}
    return JobStatusResponse(job_id=job_id, status=status, meta=meta)


@app.get("/models/{object_key}")
def model_info(object_key: str):
    storage = create_storage()
    if not storage.exists(object_key=object_key):
        raise HTTPException(status_code=404, detail="Model not found")
    return JSONResponse({"object_key": object_key, "storage_mode": settings.storage_mode})


@app.get("/models/{object_key}/download")
def download_model(object_key: str):
    storage = create_storage()
    if not storage.exists(object_key=object_key):
        raise HTTPException(status_code=404, detail="Model not found")

    local_path = storage.open_local_path(object_key=object_key)
    if local_path:
        filename = Path(local_path).name
        return FileResponse(local_path, filename=filename, media_type="application/octet-stream")

    url = storage.presigned_download_url(object_key=object_key)
    return RedirectResponse(url, status_code=302)

