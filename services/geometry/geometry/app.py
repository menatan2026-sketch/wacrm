"""HTTP surface of the geometry sandbox. Internal only: callers must present the shared secret."""

from __future__ import annotations

import hmac
import os
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from urllib.parse import unquote

from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse

from .analyze import ANALYZER_VERSION, analyze
from .validate import Limits

LIMITS = Limits(
    max_bytes=int(os.environ.get("GEOMETRY_MAX_BYTES", str(100 * 1024 * 1024))),
    timeout_seconds=int(os.environ.get("GEOMETRY_TIMEOUT_SECONDS", "60")),
)
SECRET = os.environ.get("GEOMETRY_SHARED_SECRET", "")

app = FastAPI(title="mfg-geometry", docs_url=None, redoc_url=None, openapi_url=None)
_pool: ProcessPoolExecutor | None = None


def pool() -> ProcessPoolExecutor:
    global _pool
    if _pool is None:
        _pool = ProcessPoolExecutor(max_workers=int(os.environ.get("GEOMETRY_WORKERS", "2")), max_tasks_per_child=20)
    return _pool


def _fail(code: str, status: int = 422) -> JSONResponse:
    return JSONResponse(
        {"ok": False, "analyzer_version": ANALYZER_VERSION, "duration_ms": 0, "stages": [{"stage": "parse", "status": "failed"}], "failure_code": code},
        status_code=status,
    )


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "analyzer_version": ANALYZER_VERSION}


@app.post("/analyze")
async def analyze_endpoint(request: Request, x_shared_secret: str = Header(default=""), x_file_name: str = Header(default="")):
    if not SECRET or not hmac.compare_digest(x_shared_secret.encode(), SECRET.encode()):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    declared = int(request.headers.get("content-length") or 0)
    if declared > LIMITS.max_bytes:
        return _fail("too_large")
    data = await request.body()
    if len(data) > LIMITS.max_bytes:
        return _fail("too_large")
    name = unquote(x_file_name)[:200]
    future = pool().submit(analyze, name, data, LIMITS)
    try:
        result = future.result(timeout=LIMITS.timeout_seconds)
    except FutureTimeout:
        # A runaway parse holds a worker; recycle the pool so it can't starve later requests.
        global _pool
        if _pool is not None:
            _pool.shutdown(wait=False, cancel_futures=True)
        _pool = None
        return _fail("timeout")
    return JSONResponse(result, status_code=200 if result["ok"] else 422)
