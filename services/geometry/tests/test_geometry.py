import base64
import io
import zipfile

import trimesh
from fastapi.testclient import TestClient

from geometry.analyze import analyze
from geometry.validate import Limits


def stl(mesh: trimesh.Trimesh, ascii: bool = False) -> bytes:
    out = mesh.export(file_type="stl_ascii" if ascii else "stl")
    return out.encode() if isinstance(out, str) else out


CUBE = trimesh.creation.box(extents=(40, 30, 20))


def test_binary_stl_cube_metrics():
    r = analyze("cube.stl", stl(CUBE))
    assert r["ok"] is True
    m = r["metrics"]
    assert m["bbox_mm"] == [40.0, 30.0, 20.0]
    assert abs(m["volume_mm3"] - 24000) < 1
    assert abs(m["surface_area_mm2"] - 2 * (40 * 30 + 40 * 20 + 30 * 20)) < 1
    assert m["is_watertight"] is True and m["shells"] == 1
    assert m["overhang_area_mm2"] == 0  # flat bottom rests on the plate
    assert [s["stage"] for s in r["stages"]] == ["parse", "measure", "check_geometry", "printability", "volume"]
    glb = base64.b64decode(r["preview_glb_b64"])
    assert glb[:4] == b"glTF"


def test_ascii_stl_and_cylinder_accuracy():
    cyl = trimesh.creation.cylinder(radius=10, height=50, sections=256)
    r = analyze("cyl.stl", stl(cyl, ascii=True))
    assert r["ok"]
    expected = 3.14159265 * 100 * 50
    assert abs(r["metrics"]["volume_mm3"] - expected) / expected < 0.005


def test_3mf_roundtrip():
    data = CUBE.export(file_type="3mf")
    r = analyze("part.3mf", data)
    assert r["ok"] and r["metrics"]["bbox_mm"] == [40.0, 30.0, 20.0]


def test_overhang_detected_for_floating_shelf():
    shelf = trimesh.creation.box(extents=(40, 40, 4))
    shelf.apply_translation((0, 0, 30))
    post = trimesh.creation.box(extents=(5, 5, 30))
    post.apply_translation((0, 0, 15))
    r = analyze("t.stl", stl(trimesh.util.concatenate([shelf, post])))
    assert r["ok"] and r["metrics"]["overhang_area_mm2"] > 1000


def test_small_part_units_are_unknown():
    r = analyze("tiny.stl", stl(trimesh.creation.box(extents=(2, 1.5, 0.5))))
    assert r["metrics"]["units_detected"] == "unknown"


def test_open_mesh_warns_and_still_measures():
    mesh = CUBE.copy()
    mesh.update_faces(list(range(len(mesh.faces) - 2)))
    r = analyze("open.stl", stl(mesh))
    assert r["ok"] and r["metrics"]["is_watertight"] is False
    assert "not_watertight" in r["warnings"]


def test_rejects_garbage_wrong_extension_and_empty():
    assert analyze("x.stl", b"hello world")["failure_code"] == "corrupt_file"
    assert analyze("x.obj", stl(CUBE))["failure_code"] == "unsupported_format"
    assert analyze("x.stl", b"")["failure_code"] == "corrupt_file"


def test_rejects_too_many_triangles_and_too_large():
    sphere = trimesh.creation.icosphere(subdivisions=4)
    assert analyze("s.stl", stl(sphere), Limits(max_triangles=100))["failure_code"] == "too_complex"
    assert analyze("s.stl", stl(sphere), Limits(max_bytes=1000))["failure_code"] == "too_large"


def test_rejects_zip_bomb_and_path_traversal():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("3D/3dmodel.model", b"<model/>")
        z.writestr("big.bin", b"\0" * 50_000_000)
    assert analyze("bomb.3mf", buf.getvalue())["failure_code"] == "too_complex"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("3D/3dmodel.model", b"<model/>")
        z.writestr("../../etc/passwd", b"x")
    assert analyze("trav.3mf", buf.getvalue())["failure_code"] == "corrupt_file"


def test_http_requires_shared_secret(monkeypatch):
    import geometry.app as appmod

    monkeypatch.setattr(appmod, "SECRET", "s" * 20)
    client = TestClient(appmod.app)
    assert client.post("/analyze", content=stl(CUBE), headers={"x-file-name": "c.stl"}).status_code == 401
    ok = client.post("/analyze", content=stl(CUBE), headers={"x-file-name": "c.stl", "x-shared-secret": "s" * 20})
    assert ok.status_code == 200 and ok.json()["metrics"]["triangle_count"] == 12
    bad = client.post("/analyze", content=b"junk", headers={"x-file-name": "c.stl", "x-shared-secret": "s" * 20})
    assert bad.status_code == 422 and bad.json()["failure_code"] == "corrupt_file"
