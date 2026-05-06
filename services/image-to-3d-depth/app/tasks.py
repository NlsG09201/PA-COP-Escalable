from __future__ import annotations

import logging
import uuid
from pathlib import Path

import cv2
import numpy as np

from app.celery_app import celery_app
from app.core.settings import settings
from app.recon.depth_model import get_depth_estimator
from app.recon.geometry import derive_intrinsics, depth_to_points, normalize_depth
from app.recon.open3d_export import build_mesh_from_point_cloud, export_open3d_geometry, points_to_open3d
from app.storage.factory import create_storage

logger = logging.getLogger(__name__)


def _read_image_bgr(path: str) -> np.ndarray:
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("invalid image file")
    if img.dtype != np.uint8:
        img = img.astype(np.uint8, copy=False)
    return img


@celery_app.task(name="reconstruct_3d", bind=True)
def reconstruct_3d_task(
    self,
    *,
    image_path: str,
    output_format: str,
    make_mesh: bool,
    fx: float | None,
    fy: float | None,
    cx: float | None,
    cy: float | None,
    depth_scale: float,
    depth_offset: float,
) -> dict:
    storage = create_storage()
    job_id = self.request.id or str(uuid.uuid4())

    logger.info("job_start", extra={"job_id": job_id, "output_format": output_format, "make_mesh": make_mesh})
    self.update_state(state="STARTED", meta={"stage": "loading_image"})

    bgr = _read_image_bgr(image_path)
    h, w = bgr.shape[:2]

    self.update_state(state="STARTED", meta={"stage": "depth_estimation", "w": w, "h": h})
    estimator = get_depth_estimator()
    depth = estimator.predict_depth(bgr)
    depth01 = normalize_depth(depth)

    self.update_state(state="STARTED", meta={"stage": "point_cloud"})
    if fx is None or fy is None or cx is None or cy is None:
        fx2, fy2, cx2, cy2 = derive_intrinsics(w, h, settings.intrinsics_fx_scale, settings.intrinsics_fy_scale)
        fx = fx if fx is not None else fx2
        fy = fy if fy is not None else fy2
        cx = cx if cx is not None else cx2
        cy = cy if cy is not None else cy2

    pts, cols = depth_to_points(
        depth01=depth01,
        bgr_u8=bgr,
        fx=float(fx),
        fy=float(fy),
        cx=float(cx),
        cy=float(cy),
        depth_scale=float(depth_scale),
        depth_offset=float(depth_offset),
        max_points=int(settings.point_cloud_max_points),
    )

    pc = points_to_open3d(pts, cols)
    if settings.voxel_downsample and settings.voxel_downsample > 0:
        pc = pc.voxel_down_sample(voxel_size=float(settings.voxel_downsample))

    geom = pc
    if make_mesh:
        self.update_state(state="STARTED", meta={"stage": "mesh_reconstruction"})
        geom = build_mesh_from_point_cloud(pc)

    fmt = output_format.lower().strip()
    self.update_state(state="STARTED", meta={"stage": "export", "format": fmt})
    data, content_type = export_open3d_geometry(geom, fmt)  # type: ignore[arg-type]

    model_id = str(uuid.uuid4())
    object_key = f"{model_id}.{fmt}"
    stored = storage.put_bytes(object_key=object_key, data=data, content_type=content_type)

    meta = {
        "w": w,
        "h": h,
        "fx": float(fx),
        "fy": float(fy),
        "cx": float(cx),
        "cy": float(cy),
        "points": int(len(pc.points)),
        "triangles": int(len(geom.triangles)) if make_mesh else 0,  # type: ignore[attr-defined]
        "storage_mode": settings.storage_mode,
        "object_key": stored.object_key,
        "bytes": stored.size_bytes,
        "url": stored.public_url,
    }

    logger.info("job_done", extra={"job_id": job_id, "model_id": model_id, "bytes": stored.size_bytes})

    # best-effort cleanup
    try:
        Path(image_path).unlink(missing_ok=True)
    except Exception:
        pass

    return {"model_id": model_id, "object_key": stored.object_key, "download_url": stored.public_url, "meta": meta}

