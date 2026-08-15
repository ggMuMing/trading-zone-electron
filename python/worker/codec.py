"""Length-prefixed MessagePack framing for Main ↔ Python."""

from __future__ import annotations

import sys
from typing import Any, BinaryIO

import msgpack

MAX_FRAME_BYTES = 64 * 1024 * 1024


def pack_message(payload: dict[str, Any]) -> bytes:
    body = msgpack.packb(payload, use_bin_type=True)
    if not isinstance(body, bytes):
        raise TypeError("msgpack.packb did not return bytes")
    if len(body) > MAX_FRAME_BYTES:
        raise ValueError(f"MessagePack body too large: {len(body)}")
    return len(body).to_bytes(4, "big") + body


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.buffer.write(pack_message(payload))
    sys.stdout.buffer.flush()


def read_message(buf: BinaryIO) -> dict[str, Any] | None:
    header = _read_exact(buf, 4)
    if header is None:
        return None
    size = int.from_bytes(header, "big")
    if size <= 0 or size > MAX_FRAME_BYTES:
        raise ValueError(f"invalid MessagePack frame size: {size}")
    body = _read_exact(buf, size)
    if body is None:
        raise ValueError("truncated MessagePack frame body")
    payload = msgpack.unpackb(body, raw=False, strict_map_key=False)
    if not isinstance(payload, dict):
        raise TypeError("MessagePack payload must be a map")
    return payload


def _read_exact(buf: BinaryIO, n: int) -> bytes | None:
    chunks = bytearray()
    while len(chunks) < n:
        piece = buf.read(n - len(chunks))
        if not piece:
            return None
        chunks.extend(piece)
    return bytes(chunks)
