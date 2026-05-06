from __future__ import annotations

import numpy as np


def normalize_depth(depth: np.ndarray) -> np.ndarray:
    d = depth.astype(np.float32, copy=False)
    if not np.isfinite(d).any():
        raise ValueError("depth contains no finite values")
    d = np.nan_to_num(d, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32, copy=False)
    lo = float(np.percentile(d, 1))
    hi = float(np.percentile(d, 99))
    if hi - lo < 1e-6:
        hi = lo + 1.0
    dn = (d - lo) / (hi - lo)
    dn = np.clip(dn, 0.0, 1.0).astype(np.float32, copy=False)
    return dn


def derive_intrinsics(width: int, height: int, fx_scale: float, fy_scale: float) -> tuple[float, float, float, float]:
    cx = (width - 1) / 2.0
    cy = (height - 1) / 2.0
    fx = fx_scale * max(width, height)
    fy = fy_scale * max(width, height)
    return float(fx), float(fy), float(cx), float(cy)


def depth_to_points(
    *,
    depth01: np.ndarray,
    bgr_u8: np.ndarray,
    fx: float,
    fy: float,
    cx: float,
    cy: float,
    depth_scale: float,
    depth_offset: float,
    max_points: int,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Projects depth map to point cloud with pinhole model.
    Returns (points Nx3 float32, colors Nx3 float32 in [0,1]).
    """
    if depth01.ndim != 2:
        raise ValueError("depth01 must be HxW")
    h, w = depth01.shape
    if bgr_u8.shape[:2] != (h, w):
        raise ValueError("bgr image size must match depth")

    # Convert depth to meters-ish scale (arbitrary but stable for visualization).
    z = depth_offset + depth_scale * (1.0 - depth01)  # invert so closer = larger depth01 → smaller z
    z = z.astype(np.float32, copy=False)

    ys, xs = np.mgrid[0:h, 0:w]
    xs = xs.astype(np.float32)
    ys = ys.astype(np.float32)

    x = (xs - float(cx)) * z / float(fx)
    y = (ys - float(cy)) * z / float(fy)

    pts = np.stack([x, -y, z], axis=-1).reshape(-1, 3).astype(np.float32, copy=False)
    cols = (bgr_u8.reshape(-1, 3)[:, ::-1].astype(np.float32) / 255.0).astype(np.float32, copy=False)

    finite = np.isfinite(pts).all(axis=1)
    pts = pts[finite]
    cols = cols[finite]

    n = pts.shape[0]
    if n > max_points:
        idx = np.random.default_rng(0).choice(n, size=max_points, replace=False)
        pts = pts[idx]
        cols = cols[idx]

    return pts, cols

