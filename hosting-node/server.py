#!/usr/bin/env python3
"""First full Open Marketplace host.

Stores the public marketplace dataset (listings, public seller profiles, and
content-addressed listing photos). It never accepts passwords, session tokens,
Facebook tokens, or identity documents.
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import policy
import store

MAX_MEDIA_BYTES = 12_000_000
MAX_OBJECT_BYTES = 256_000
MAX_DECREE_BYTES = 64_000


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_token() -> str:
    return (
        os.environ.get("HOST_WRITE_TOKEN")
        or os.environ.get("MEDIA_NODE_WRITE_TOKEN")
        or ""
    ).strip()


def host_id() -> str:
    return (os.environ.get("HOST_ID") or "synology-nas-001").strip() or "synology-nas-001"


def host_origin() -> str:
    return (os.environ.get("HOST_ORIGIN") or "").strip()


def min_replicas() -> int:
    raw = os.environ.get("HOST_MIN_REPLICAS") or str(policy.DEFAULT_MIN_REPLICAS)
    try:
        value = int(raw)
    except ValueError:
        return policy.DEFAULT_MIN_REPLICAS
    return value if 1 <= value <= 32 else policy.DEFAULT_MIN_REPLICAS


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


def ensure_genesis() -> None:
    store.data_root()
    current = store.get_decree()
    if current:
        return
    decree = policy.genesis_decree(host_id(), host_origin(), min_replicas())
    decree["issuedAt"] = utc_now()
    store.put_decree(decree)
    store.upsert_host(decree["hosts"][0])


def current_decree() -> dict:
    ensure_genesis()
    decree = store.get_decree()
    if decree:
        return decree
    return policy.genesis_decree(host_id(), host_origin(), min_replicas())


def authorized(handler: BaseHTTPRequestHandler) -> bool:
    token = write_token()
    if not token:
        return False
    return handler.headers.get("Authorization", "") == f"Bearer {token}"


def validate_source_url(url: str) -> str | None:
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return None
    if parsed.scheme not in ("https", "http"):
        return None
    if parsed.username or parsed.password:
        return None
    host = (parsed.hostname or "").lower()
    if not host:
        return None
    if host in {"169.254.169.254", "metadata.google.internal"}:
        return None
    try:
        ip = ipaddress.ip_address(host)
        loopback_http = parsed.scheme == "http" and ip.is_loopback
        if ip.is_private or ip.is_link_local or ip.is_multicast:
            return None
        if ip.is_loopback and not loopback_http:
            return None
    except ValueError:
        if parsed.scheme == "http" and host not in {"localhost"}:
            return None
    return f"{parsed.scheme}://{parsed.netloc}"


def pull_public_registry(source: str) -> dict:
    origin = validate_source_url(source)
    if not origin:
        raise ValueError("invalid_source")
    request = Request(
        f"{origin}/api/listings?limit=100",
        headers={"Accept": "application/json", "User-Agent": "OpenMarketplaceHost/2.0"},
    )
    with urlopen(request, timeout=20) as response:  # noqa: S310
        payload = json.loads(response.read().decode("utf-8"))
    listings = payload.get("listings") if isinstance(payload, dict) else None
    if not isinstance(listings, list):
        raise ValueError("invalid_registry_payload")
    stored = 0
    profiles = 0
    for row in listings:
        if not isinstance(row, dict):
            continue
        try:
            listing = policy.sanitize_public_record("listing", row)
            store.put_object("listing", listing["id"], listing)
            stored += 1
        except ValueError:
            continue
        profile_source = {
            "id": row.get("sellerId"),
            "displayName": row.get("sellerName"),
            "sellerName": row.get("sellerName"),
            "socialProofs": row.get("socialProofs") or row.get("socialProofsJson"),
            "paymentDestinations": row.get("paymentDestinations")
            or row.get("paymentDestinationsJson"),
            "itemsSold": row.get("itemsSold"),
            "sellerRating": row.get("sellerRating"),
            "sellerRatingCount": row.get("sellerRatingCount"),
            "buyerRating": row.get("buyerRating"),
            "buyerRatingCount": row.get("buyerRatingCount"),
        }
        try:
            profile = policy.sanitize_public_record("profile", profile_source)
            store.put_object("profile", profile["id"], profile)
            profiles += 1
        except ValueError:
            continue
    return {"ok": True, "listings": stored, "profiles": profiles, "source": origin}


def local_inventory_map() -> dict[str, set[str]]:
    held: set[str] = set()
    for kind, ids in store.inventory().items():
        for record_id in ids:
            held.add(f"{kind}:{record_id}")
    for hex_digest in store.list_media_hashes():
        held.add(f"media:{hex_digest}")
    return {host_id(): held}


def scale_down() -> dict:
    decree = current_decree()
    ok, reason = policy.validate_decree(decree)
    if not ok:
        return {"ok": False, "error": reason}
    if decree.get("mode") != "sharded":
        return {"ok": False, "error": "full_mode_keeps_all_copies"}
    inventories = local_inventory_map()
    dropped = 0
    kept = 0
    for kind in policy.OBJECT_KINDS:
        for record in store.list_objects(kind):
            object_id = f"{kind}:{record['id']}"
            allowed, drop_reason = policy.can_drop_object(
                host_id(),
                object_id,
                inventories,
                decree,
            )
            if allowed:
                store.delete_object(kind, record["id"])
                inventories[host_id()].discard(object_id)
                dropped += 1
            else:
                kept += 1
                if drop_reason:
                    pass
    return {
        "ok": True,
        "dropped": dropped,
        "kept": kept,
        "mode": decree.get("mode"),
        "minReplicas": decree.get("minReplicas"),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "OpenMarketplaceHost/2.0"

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
            self.send_header(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type, Accept",
            )
            self.send_header(
                "Access-Control-Allow-Methods",
                "GET, PUT, POST, DELETE, OPTIONS",
            )
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, payload: dict, origin: str | None) -> None:
        self._send(status, json.dumps(payload).encode("utf-8"), "application/json", origin)

    def _read_body(self, maximum: int) -> bytes | None:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0 or length > maximum:
            return None
        return self.rfile.read(length)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, b"", "text/plain", self.headers.get("Origin"))

    def do_GET(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        path = urlparse(self.path).path
        ensure_genesis()
        if path == "/health":
            self._json(200, self._health_payload(), origin)
            return
        if path in {"/v1/status", "/status"}:
            self._json(200, self._status_payload(), origin)
            return
        if path == "/v1/decree":
            self._json(200, {"decree": current_decree()}, origin)
            return
        if path == "/v1/hosts":
            self._json(200, {"hosts": store.get_hosts()}, origin)
            return
        if path == "/v1/inventory":
            self._json(
                200,
                {
                    "hostId": host_id(),
                    "inventory": store.inventory(),
                    "media": store.list_media_hashes(),
                },
                origin,
            )
            return
        if path == "/v1/catalog":
            self._json(
                200,
                {
                    "listings": store.list_objects("listing"),
                    "profiles": store.list_objects("profile"),
                },
                origin,
            )
            return
        object_ref = self._object_from_path(path)
        if object_ref:
            record = store.get_object(*object_ref)
            if not record:
                self._json(404, {"error": "not_found"}, origin)
                return
            self._json(200, {"kind": object_ref[0], "object": record}, origin)
            return
        hex_digest = self._hash_from_path(path)
        if hex_digest:
            try:
                file_path = store.media_path(hex_digest)
            except ValueError:
                self._json(400, {"error": "invalid_hash"}, origin)
                return
            if not file_path.is_file():
                self._json(404, {"error": "not_found"}, origin)
                return
            self._send(200, file_path.read_bytes(), "application/octet-stream", origin)
            return
        self._json(404, {"error": "not_found"}, origin)

    def do_PUT(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        path = urlparse(self.path).path
        ensure_genesis()
        if not write_token():
            self._json(503, {"error": "write_disabled"}, origin)
            return
        if not authorized(self):
            self._json(401, {"error": "unauthorized"}, origin)
            return
        if path == "/v1/decree":
            raw = self._read_body(MAX_DECREE_BYTES)
            if raw is None:
                self._json(413, {"error": "too_large"}, origin)
                return
            try:
                decree = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._json(400, {"error": "invalid_json"}, origin)
                return
            if isinstance(decree, dict) and "decree" in decree:
                decree = decree["decree"]
            ok, reason = policy.validate_decree(decree)
            if not ok:
                self._json(409, {"error": reason}, origin)
                return
            decree["issuedAt"] = decree.get("issuedAt") or utc_now()
            store.put_decree(decree)
            for host in decree.get("hosts", []):
                if isinstance(host, dict):
                    store.upsert_host(host)
            self._json(200, {"ok": True, "decree": decree}, origin)
            return
        if path.startswith("/v1/hosts/"):
            peer_id = path.split("/v1/hosts/", 1)[1].strip()
            raw = self._read_body(MAX_OBJECT_BYTES)
            if raw is None:
                self._json(413, {"error": "too_large"}, origin)
                return
            try:
                host = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._json(400, {"error": "invalid_json"}, origin)
                return
            if not isinstance(host, dict):
                self._json(400, {"error": "invalid_host"}, origin)
                return
            host["hostId"] = peer_id or host.get("hostId")
            try:
                hosts = store.upsert_host(host)
            except ValueError:
                self._json(400, {"error": "invalid_host"}, origin)
                return
            self._json(200, {"ok": True, "hosts": hosts}, origin)
            return
        object_ref = self._object_from_path(path)
        if object_ref:
            raw = self._read_body(MAX_OBJECT_BYTES)
            if raw is None:
                self._json(413, {"error": "too_large"}, origin)
                return
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                self._json(400, {"error": "invalid_json"}, origin)
                return
            if isinstance(payload, dict) and "object" in payload:
                payload = payload["object"]
            try:
                record = policy.sanitize_public_record(object_ref[0], payload)
            except ValueError as error:
                self._json(400, {"error": str(error)}, origin)
                return
            if record["id"] != object_ref[1]:
                self._json(400, {"error": "id_mismatch"}, origin)
                return
            store.put_object(object_ref[0], record["id"], record)
            self._json(201, {"ok": True, "kind": object_ref[0], "id": record["id"]}, origin)
            return
        hex_digest = self._hash_from_path(path)
        if not hex_digest:
            self._json(400, {"error": "invalid_path"}, origin)
            return
        body = self._read_body(MAX_MEDIA_BYTES)
        if body is None:
            self._json(413, {"error": "too_large"}, origin)
            return
        actual = hashlib.sha256(body).hexdigest()
        if actual != hex_digest:
            self._json(422, {"error": "hash_mismatch"}, origin)
            return
        target = store.media_path(hex_digest)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
        self._json(201, {"ok": True, "hash": f"sha256:{hex_digest}"}, origin)

    def do_POST(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        path = urlparse(self.path).path
        ensure_genesis()
        if not write_token():
            self._json(503, {"error": "write_disabled"}, origin)
            return
        if not authorized(self):
            self._json(401, {"error": "unauthorized"}, origin)
            return
        if path == "/v1/sync/pull":
            raw = self._read_body(MAX_OBJECT_BYTES) or b"{}"
            try:
                payload = json.loads(raw.decode("utf-8") or "{}")
            except (UnicodeDecodeError, json.JSONDecodeError):
                payload = {}
            source = str(
                (payload.get("source") if isinstance(payload, dict) else None)
                or os.environ.get("SOURCE_REGISTRY_URL")
                or ""
            )
            try:
                result = pull_public_registry(source)
            except ValueError as error:
                self._json(400, {"error": str(error)}, origin)
                return
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
                self._json(502, {"error": "registry_unreachable"}, origin)
                return
            self._json(200, result, origin)
            return
        if path == "/v1/scale-down":
            result = scale_down()
            self._json(200 if result.get("ok") else 409, result, origin)
            return
        self._json(404, {"error": "not_found"}, origin)

    def do_DELETE(self) -> None:  # noqa: N802
        origin = self.headers.get("Origin")
        path = urlparse(self.path).path
        ensure_genesis()
        if not write_token():
            self._json(503, {"error": "write_disabled"}, origin)
            return
        if not authorized(self):
            self._json(401, {"error": "unauthorized"}, origin)
            return
        object_ref = self._object_from_path(path)
        if not object_ref:
            self._json(400, {"error": "invalid_path"}, origin)
            return
        object_id = f"{object_ref[0]}:{object_ref[1]}"
        allowed, reason = policy.can_drop_object(
            host_id(),
            object_id,
            local_inventory_map(),
            current_decree(),
        )
        if not allowed:
            self._json(409, {"error": reason}, origin)
            return
        deleted = store.delete_object(*object_ref)
        self._json(200 if deleted else 404, {"ok": deleted, "id": object_ref[1]}, origin)

    def _health_payload(self) -> dict:
        decree = current_decree()
        return {
            "ok": True,
            "role": "full-replica",
            "hostId": host_id(),
            "minReplicas": decree.get("minReplicas", min_replicas()),
            "mode": decree.get("mode", "full"),
            "hostCount": len(store.get_hosts() or decree.get("hosts") or []),
        }

    def _status_payload(self) -> dict:
        decree = current_decree()
        hosts = store.get_hosts()
        return {
            "ok": True,
            "role": "full-replica",
            "hostId": host_id(),
            "firstHost": True,
            "minReplicas": decree.get("minReplicas", min_replicas()),
            "mode": decree.get("mode", "full"),
            "shardCount": decree.get("shardCount", policy.DEFAULT_SHARD_COUNT),
            "hostCount": len(hosts),
            "hosts": hosts,
            "counts": store.counts(),
            "decreeIssuedBy": decree.get("issuedBy"),
            "scaleDownReady": (
                decree.get("mode") == "sharded"
                and len(hosts) >= int(decree.get("minReplicas") or min_replicas())
            ),
        }

    def _object_from_path(self, path: str) -> tuple[str, str] | None:
        parts = [part for part in path.split("/") if part]
        if len(parts) != 4 or parts[0] != "v1" or parts[1] != "objects":
            return None
        kind, record_id = parts[2], parts[3]
        if kind not in policy.OBJECT_KINDS:
            return None
        if not store.SAFE_ID_RE.fullmatch(record_id):
            return None
        return kind, record_id

    def _hash_from_path(self, path: str) -> str | None:
        parts = [part for part in path.split("/") if part]
        if len(parts) != 3 or parts[0] != "media" or parts[1] != "sha256":
            return None
        if not store.HEX_RE.fullmatch(parts[2]):
            return None
        return parts[2]


def sync_loop() -> None:
    interval_raw = os.environ.get("HOST_SYNC_INTERVAL_SECONDS") or "0"
    try:
        interval = int(interval_raw)
    except ValueError:
        interval = 0
    source = (os.environ.get("SOURCE_REGISTRY_URL") or "").strip()
    if interval < 1 or not source:
        return
    while True:
        time.sleep(interval)
        try:
            pull_public_registry(source)
        except Exception:
            continue


def main() -> None:
    ensure_genesis()
    threading.Thread(target=sync_loop, name="host-sync", daemon=True).start()
    host = os.environ.get("MEDIA_NODE_HOST") or os.environ.get("HOST_BIND") or "0.0.0.0"
    port = int(os.environ.get("MEDIA_NODE_PORT") or os.environ.get("HOST_PORT") or "8788")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
