"""Pre-parse validation of untrusted bytes (SECURITY.md §5). Nothing here trusts the file name."""

from __future__ import annotations

import io
import struct
import zipfile
from dataclasses import dataclass


class Rejected(Exception):
    """Typed failure that maps to a customer-facing reason code."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Limits:
    max_bytes: int = 100 * 1024 * 1024
    max_triangles: int = 5_000_000
    max_uncompressed_bytes: int = 600 * 1024 * 1024
    max_zip_ratio: int = 100
    timeout_seconds: int = 60


def sniff(name: str, data: bytes, limits: Limits) -> str:
    """Return the detected format ("stl" or "3mf") or raise Rejected."""
    if len(data) == 0:
        raise Rejected("corrupt_file")
    if len(data) > limits.max_bytes:
        raise Rejected("too_large")
    ext = name.lower().rsplit(".", 1)[-1] if "." in name else ""
    if data[:4] == b"PK\x03\x04":
        if ext != "3mf":
            raise Rejected("unsupported_format")
        _check_zip(data, limits)
        return "3mf"
    if ext != "stl":
        raise Rejected("unsupported_format")
    if len(data) >= 84:
        (count,) = struct.unpack_from("<I", data, 80)
        if 84 + 50 * count == len(data):
            if count > limits.max_triangles:
                raise Rejected("too_complex")
            if count == 0:
                raise Rejected("corrupt_file")
            return "stl"
    head = data[:1024].lstrip().lower()
    if head.startswith(b"solid") and b"facet" in data[:65536].lower():
        if data.count(b"facet normal") > limits.max_triangles:
            raise Rejected("too_complex")
        return "stl"
    raise Rejected("corrupt_file")


def _check_zip(data: bytes, limits: Limits) -> None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            infos = z.infolist()
            names = {i.filename for i in infos}
            if not any(n.lower().endswith(".model") for n in names):
                raise Rejected("corrupt_file")
            total = 0
            for info in infos:
                if info.filename.startswith("/") or ".." in info.filename.split("/"):
                    raise Rejected("corrupt_file")
                total += info.file_size
                if info.compress_size and info.file_size / max(info.compress_size, 1) > limits.max_zip_ratio:
                    raise Rejected("too_complex")
            if total > limits.max_uncompressed_bytes:
                raise Rejected("too_large")
    except zipfile.BadZipFile as exc:
        raise Rejected("corrupt_file") from exc
