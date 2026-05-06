from __future__ import annotations

import io
import logging
from typing import Literal

import numpy as np
import open3d as o3d

from app.core.settings import settings

logger = logging.getLogger(__name__)

OutFmt = Literal["ply", "obj", "stl"]


def points_to_open3d(pts: np.ndarray, cols: np.ndarray) -> o3d.geometry.PointCloud:
    pc = o3d.geometry.PointCloud()
    pc.points = o3d.utility.Vector3dVector(pts.astype(np.float64, copy=False))
    if cols is not None:
        pc.colors = o3d.utility.Vector3dVector(cols.astype(np.float64, copy=False))
    return pc


def build_mesh_from_point_cloud(pc: o3d.geometry.PointCloud) -> o3d.geometry.TriangleMesh:
    if settings.estimate_normals:
        pc.estimate_normals(search_param=o3d.geometry.KDTreeSearchParamHybrid(radius=0.04, max_nn=30))
        pc.orient_normals_consistent_tangent_plane(30)

    logger.info("poisson_reconstruction_start", extra={"depth": int(settings.poisson_depth)})
    mesh, densities = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
        pc, depth=int(settings.poisson_depth)
    )
    densities = np.asarray(densities, dtype=np.float32)
    if densities.size > 0:
        thr = float(np.percentile(densities, 5))
        mask = densities < thr
        mesh.remove_vertices_by_mask(mask.tolist())
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_non_manifold_edges()
    mesh.compute_vertex_normals()
    logger.info("poisson_reconstruction_done", extra={"triangles": len(mesh.triangles)})
    return mesh


def export_open3d_geometry(geom: o3d.geometry.Geometry, fmt: OutFmt) -> tuple[bytes, str]:
    """
    Exports to bytes (PLY/OBJ/STL) by writing to an in-memory file-like where supported.
    Open3D writer APIs are file-path based, so we write to a temp path in memory-like buffer by using a NamedTemporaryFile.
    """
    import tempfile
    from pathlib import Path

    suffix = f".{fmt}"
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / f"model{suffix}"
        ok = False
        if fmt == "ply":
            if isinstance(geom, o3d.geometry.PointCloud):
                ok = o3d.io.write_point_cloud(str(out), geom, write_ascii=False, compressed=False)
            else:
                ok = o3d.io.write_triangle_mesh(str(out), geom, write_ascii=False, compressed=False)
            content_type = "application/octet-stream"
        elif fmt == "obj":
            if not isinstance(geom, o3d.geometry.TriangleMesh):
                raise ValueError("OBJ export requires a mesh")
            ok = o3d.io.write_triangle_mesh(str(out), geom, write_ascii=False, compressed=False)
            content_type = "text/plain"
        elif fmt == "stl":
            if not isinstance(geom, o3d.geometry.TriangleMesh):
                raise ValueError("STL export requires a mesh")
            ok = o3d.io.write_triangle_mesh(str(out), geom, write_ascii=False, compressed=False)
            content_type = "model/stl"
        else:
            raise ValueError(f"Unsupported format: {fmt}")

        if not ok or not out.exists():
            raise RuntimeError(f"Open3D export failed ({fmt})")
        data = out.read_bytes()
        return data, content_type

