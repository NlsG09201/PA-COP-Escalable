"""
CBCT DICOM (ZIP) → GLB generator (dev-grade, robust defaults).

Accepts a ZIP with a single DICOM series (CBCT). Performs a basic HU threshold segmentation
and converts the resulting surface to a GLB mesh.

NOTE: This is not a clinical-grade segmentation pipeline; it's meant to reliably produce a 3D mesh.
"""

from __future__ import annotations

import io
import os
import shutil
import tempfile
import uuid
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import pydicom  # noqa: F401 (forces GDCM/pydicom availability)
import SimpleITK as sitk
import trimesh
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response
from skimage import measure

app = FastAPI(title="DICOM→GLB", version="1.0.0")

STORE_DIR = Path(os.environ.get("DICOM_TO_GLB_STORE_DIR", "/tmp/dicom-to-glb"))
STORE_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/", response_class=HTMLResponse)
def root() -> str:
    return (
        "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"utf-8\"/>"
        "<title>DICOM→GLB</title>"
        '<link rel="icon" href="data:image/svg+xml,'
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
        "<rect width='32' height='32' rx='6' fill='%23059669'/></svg>"
        "\"/>"
        "</head><body><p>Servicio DICOM→GLB. "
        'API: <a href="/docs">/docs</a> · <a href="/health">health</a>.</p>'
        "</body></html>"
    )


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _extract_zip_to_dir(data: bytes, out_dir: Path) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            zf.extractall(out_dir)
    except zipfile.BadZipFile as e:
        raise HTTPException(status_code=400, detail=f"Invalid ZIP: {e}") from e


def _find_dicom_files(root: Path) -> list[str]:
    files: list[str] = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        # Many DICOM files have no extension; just include all files and let GDCM filter.
        files.append(str(p))
    return files


def _load_series_image(series_dir: Path) -> sitk.Image:
    reader = sitk.ImageSeriesReader()
    series_ids = reader.GetGDCMSeriesIDs(str(series_dir))
    if not series_ids:
        raise HTTPException(status_code=400, detail="No DICOM series found in ZIP")
    series_uid = series_ids[0]
    file_names = reader.GetGDCMSeriesFileNames(str(series_dir), series_uid)
    if not file_names:
        raise HTTPException(status_code=400, detail="DICOM series has no readable files")
    reader.SetFileNames(file_names)
    try:
        img = reader.Execute()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to read DICOM series: {e}") from e
    return img


def _segment_tooth_bone_mask(img: sitk.Image) -> np.ndarray:
    # Convert to numpy (z, y, x). For CBCT, intensities may not be true HU, but thresholds still work.
    arr = sitk.GetArrayFromImage(img).astype(np.float32)

    # Robust threshold: prefer env override, else typical range for bone/teeth.
    thr = float(os.environ.get("DICOM_TO_GLB_THRESHOLD", "350"))
    mask = arr > thr

    # Clean up small noise with simple morphological operations (in voxel space).
    mask_img = sitk.GetImageFromArray(mask.astype(np.uint8))
    mask_img.CopyInformation(img)
    mask_img = sitk.BinaryMorphologicalClosing(mask_img, [2, 2, 1])
    mask_img = sitk.BinaryMorphologicalOpening(mask_img, [1, 1, 1])
    cleaned = sitk.GetArrayFromImage(mask_img).astype(bool)
    return cleaned


def _mask_to_mesh(mask_zyx: np.ndarray, spacing_xyz: tuple[float, float, float]) -> trimesh.Trimesh:
    # marching_cubes expects spacing for (z, y, x)
    sx, sy, sz = spacing_xyz
    try:
        verts, faces, _normals, _values = measure.marching_cubes(
            mask_zyx.astype(np.uint8),
            level=0.5,
            spacing=(sz, sy, sx),
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"marching_cubes failed: {e}") from e

    mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=True)
    if mesh.is_empty:
        raise HTTPException(status_code=500, detail="Empty mesh after segmentation")

    # Center mesh near origin for nicer viewing.
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    return mesh


def _export_glb(mesh: trimesh.Trimesh, out_path: Path) -> None:
    try:
        glb = mesh.export(file_type="glb")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to export GLB: {e}") from e
    out_path.write_bytes(glb)


@app.post("/openapi/v1/dicom-to-3d")
async def create_job(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")
    raw = await file.read()
    if len(raw) < 100:
        raise HTTPException(status_code=400, detail="Empty upload")

    job_id = str(uuid.uuid4())
    job_dir = STORE_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    zip_dir = job_dir / "zip"
    zip_dir.mkdir(parents=True, exist_ok=True)
    glb_path = job_dir / "result.glb"

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        _extract_zip_to_dir(raw, tmp_dir)

        # Some zips have nested folders; load by scanning for series at root.
        img = _load_series_image(tmp_dir)
        spacing = img.GetSpacing()  # (x,y,z)
        mask = _segment_tooth_bone_mask(img)
        mesh = _mask_to_mesh(mask, spacing)
        _export_glb(mesh, glb_path)

        # Keep a copy of the zip for debugging (optional)
        try:
            (job_dir / "input.zip").write_bytes(raw)
        except Exception:
            pass

    public_url = f"/openapi/v1/dicom-to-3d/files/{job_id}.glb"
    return {
        "jobId": job_id,
        "id": job_id,
        "status": "SUCCEEDED",
        "state": "complete",
        "glbUrl": public_url,
        "glb_url": public_url,
        "result_url": public_url,
    }


@app.get("/openapi/v1/dicom-to-3d/{job_id}")
def poll_job(job_id: str) -> dict[str, Any]:
    glb_path = STORE_DIR / job_id / "result.glb"
    if glb_path.is_file():
        public_url = f"/openapi/v1/dicom-to-3d/files/{job_id}.glb"
        return {
            "jobId": job_id,
            "id": job_id,
            "status": "SUCCEEDED",
            "state": "complete",
            "glbUrl": public_url,
            "glb_url": public_url,
            "result_url": public_url,
        }
    return {"jobId": job_id, "id": job_id, "status": "PROCESSING", "state": "running"}


@app.get("/openapi/v1/dicom-to-3d/files/{name}")
def download_file(name: str):
    # name is like {jobId}.glb
    if not name.endswith(".glb"):
        raise HTTPException(status_code=404, detail="Not found")
    job_id = name[: -len(".glb")]
    glb_path = STORE_DIR / job_id / "result.glb"
    if not glb_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(str(glb_path), media_type="model/gltf-binary", filename="jaw.glb")

