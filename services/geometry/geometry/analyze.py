"""Mesh metrics for manufacturability and pricing (ARCHITECTURE.md §7)."""

from __future__ import annotations

import base64
import io
import math
import time

import numpy as np
import trimesh

from .validate import Limits, Rejected, sniff

ANALYZER_VERSION = "trimesh-1"
PREVIEW_MAX_FACES = 100_000
OVERHANG_ANGLE_DEG = 45.0


def _load(fmt: str, data: bytes) -> trimesh.Trimesh:
    try:
        loaded = trimesh.load(io.BytesIO(data), file_type=fmt, force="mesh", process=True)
    except Exception as exc:  # parsers raise many types on malformed input
        raise Rejected("corrupt_file") from exc
    if isinstance(loaded, trimesh.Scene):
        meshes = [g for g in loaded.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            raise Rejected("corrupt_file")
        loaded = trimesh.util.concatenate(meshes)
    if not isinstance(loaded, trimesh.Trimesh) or len(loaded.faces) == 0:
        raise Rejected("corrupt_file")
    return loaded


def _overhang_area(mesh: trimesh.Trimesh) -> float:
    """Area of downward faces steeper than 45° that need support, excluding the build-plate contact."""
    normals = mesh.face_normals
    threshold = -math.cos(math.radians(OVERHANG_ANGLE_DEG))
    z_min = mesh.bounds[0][2]
    centroid_z = mesh.triangles_center[:, 2]
    mask = (normals[:, 2] < threshold) & (centroid_z > z_min + 0.5)
    return float(mesh.area_faces[mask].sum())


def _units(extents: np.ndarray) -> str:
    """STL has no units. Very small parts are ambiguous (could be inches); the customer confirms."""
    return "unknown" if float(extents.max()) < 15 else "mm"


def _preview(mesh: trimesh.Trimesh) -> str | None:
    target = mesh
    if len(mesh.faces) > PREVIEW_MAX_FACES:
        try:
            import fast_simplification

            ratio = 1 - PREVIEW_MAX_FACES / len(mesh.faces)
            points, faces = fast_simplification.simplify(mesh.vertices, mesh.faces, target_reduction=ratio)
            target = trimesh.Trimesh(points, faces, process=False)
        except Exception:  # noqa: BLE001 - decimation is best-effort; failing only skips the preview
            return None
    centered = target.copy()
    centered.apply_translation(-centered.bounds.mean(axis=0))
    return base64.b64encode(centered.export(file_type="glb")).decode("ascii")


DEFAULT_LIMITS = Limits()


def analyze(name: str, data: bytes, limits: Limits = DEFAULT_LIMITS) -> dict:
    started = time.monotonic()
    stages: list[dict] = []

    def stage(name: str, status: str = "done") -> None:
        stages.append({"stage": name, "status": status})

    def failure(code: str) -> dict:
        return {
            "ok": False,
            "analyzer_version": ANALYZER_VERSION,
            "duration_ms": int((time.monotonic() - started) * 1000),
            "stages": stages,
            "failure_code": code,
        }

    try:
        fmt = sniff(name, data, limits)
        mesh = _load(fmt, data)
        if len(mesh.faces) > limits.max_triangles:
            raise Rejected("too_complex")
    except Rejected as rej:
        stage("parse", "failed")
        return failure(rej.code)
    stage("parse")

    extents = mesh.extents
    if not np.all(np.isfinite(extents)) or float(extents.min()) <= 0:
        stage("measure", "failed")
        return failure("degenerate_geometry")
    stage("measure")

    warnings: list[str] = []
    watertight = bool(mesh.is_watertight)
    shells = mesh.body_count
    if not watertight:
        warnings.append("not_watertight")
    if shells > 1:
        warnings.append("multiple_shells")
    if mesh.is_winding_consistent is False:
        warnings.append("inconsistent_normals")
    stage("check_geometry")

    overhang = _overhang_area(mesh)
    if overhang > 0.3 * mesh.area:
        warnings.append("large_overhangs")
    stage("printability")

    volume = abs(float(mesh.volume))
    if not watertight:
        # Signed volume of an open mesh is unreliable; fall back to the convex hull as an upper bound.
        volume = float(mesh.convex_hull.volume)
    stage("volume")

    preview = _preview(mesh)
    return {
        "ok": True,
        "analyzer_version": ANALYZER_VERSION,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "stages": stages,
        "metrics": {
            "units_detected": _units(extents),
            "bbox_mm": [round(float(v), 3) for v in extents],
            "volume_mm3": round(volume, 3),
            "surface_area_mm2": round(float(mesh.area), 3),
            "overhang_area_mm2": round(overhang, 3),
            "triangle_count": len(mesh.faces),
            "shells": shells,
            "is_watertight": watertight,
        },
        "warnings": warnings,
        "preview_glb_b64": preview,
    }
