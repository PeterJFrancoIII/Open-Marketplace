#!/usr/bin/env python3
"""Trusted-device media node for Open Marketplace listing photos.

Stores content-addressed image bytes only. It never accepts listing metadata
and never talks to the Cloudflare D1 registry.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HEX_RE = re.compile(r"^[a-f0-9]{64}$")
MAX_BYTES = 12_000_000


def data_dir() -> Path:
    path = Path(os.environ.get("MEDIA_NODE_DATA", "/data"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_token() -> str:
    return os.environ.get("MEDIA_NODE_WRITE_TOKEN", "").strip()


def cors_origins() -> list[str]:
    raw = os.environ.get(
        "MEDIA_NODE_CORS_ORIGINS",
        "https://feature-account-management-p.open-marketplace-demo.pages.dev,http://localhost:5173,http://127.0.0.1:5173",
    )
    return [item.strip() for item in raw.split(",") if item.strip()]


def allow_origin(origin: str | None) -> str | None:
    if not origin:
        return None
    allowed = cors_origins()
    if origin in allowed or "*" in allowed:
        return origin
    return None


class Handler(BaseHTTPRequestHandler):
    server_version = "OpenMarketplaceMediaNode/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        super().log_message(format, *args)

    def _send(self, status: int, body: bytes, content_type: str, origin: str | None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        allowed = allow_origin(origin)
        if allowed:
            self.send_header("Access-Control-Allow-Origin", allowed)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
            self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, payload: dict, origin: str | None) -> None:
        self._send(status, json.dumps(payload).encode("utf-8"), "application/json", origin)

    def do_OPTIONS(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        self._send(204, b"", "text/plain", origin)

    def do_GET(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"ok": True, "role": "trusted-media-node"}, origin)
            return
        hex_digest = self._hash_from_path(parsed.path)
        if not hex_digest:
            self._json(404, {"error": "not_found"}, origin)
            return
        file_path = data_dir() / hex_digest
        if not file_path.is_file():
            self._json(404, {"error": "not_found"}, origin)
            return
        body = file_path.read_bytes()
        self._send(200, body, "application/octet-stream", origin)

    def do_PUT(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        token = write_token()
        if not token:
            self._json(503, {"error": "write_disabled"}, origin)
            return
        auth = self.headers.get("Authorization", "")
        if auth != f"Bearer {token}":
            self._json(401, {"error": "unauthorized"}, origin)
            return
        hex_digest = self._hash_from_path(urlparse(self.path).path)
        if not hex_digest:
            self._json(400, {"error": "invalid_hash"}, origin)
            return
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > MAX_BYTES:
            self._json(413, {"error": "too_large"}, origin)
            return
        body = self.rfile.read(length)
        actual = hashlib.sha256(body).hexdigest()
        if actual != hex_digest:
            self._json(422, {"error": "hash_mismatch"}, origin)
            return
        target = data_dir() / hex_digest
        target.write_bytes(body)
        self._json(201, {"ok": True, "hash": f"sha256:{hex_digest}"}, origin)

    def _hash_from_path(self, path: str) -> str | None:
        parts = [part for part in path.split("/") if part]
        if len(parts) != 3 or parts[0] != "media" or parts[1] != "sha256":
            return None
        if not HEX_RE.fullmatch(parts[2]):
            return None
        return parts[2]


def main() -> None:
    host = os.environ.get("MEDIA_NODE_HOST", "0.0.0.0")
    port = int(os.environ.get("MEDIA_NODE_PORT", "8788"))
    data_dir()
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
