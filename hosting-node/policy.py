"""Replica-floor and Main-decree rules for Open Marketplace hosts.

Every live host keeps a full copy until at least MIN_REPLICAS hosts exist.
Main may then issue a sharded decree. Hosts refuse any drop that would leave
a record below that floor.
"""

from __future__ import annotations

import json
import re
from typing import Any

MEDIA_HASH_RE = re.compile(r"^sha256:([a-f0-9]{64})$", re.I)

DEFAULT_MIN_REPLICAS = 3
DEFAULT_SHARD_COUNT = 16
FIRST_HOST_ID = "open-marketplace-first-public-database-host"
DECREE_KIND = "open-marketplace-host-decree"
OBJECT_KINDS = ("listing", "profile")
FORBIDDEN_OBJECT_KEYS = {
    "password",
    "accessToken",
    "refreshToken",
    "access_token",
    "refresh_token",
    "idToken",
    "id_token",
    "email",
    "emailVerified",
    "token",
    "cookie",
    "privateKey",
    "seed",
    "secret",
    "session",
    "ipAddress",
    "userAgent",
    "reporterFingerprint",
}


def fnv1a32(text: str) -> int:
    h = 2166136261
    for byte in text.encode("utf-8"):
        h ^= byte
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def shard_for(object_id: str, shard_count: int = DEFAULT_SHARD_COUNT) -> int:
    if shard_count < 1:
        return 0
    return fnv1a32(object_id) % shard_count


def choose_host_index(object_id: str, host_count: int) -> int:
    if host_count < 1:
        return -1
    return fnv1a32(object_id) % host_count


def genesis_decree(host_id: str, origin: str = "", min_replicas: int = DEFAULT_MIN_REPLICAS) -> dict[str, Any]:
    return {
        "v": 1,
        "kind": DECREE_KIND,
        "issuedAt": "",
        "issuedBy": "bootstrap",
        "minReplicas": min_replicas,
        "mode": "full",
        "shardCount": DEFAULT_SHARD_COUNT,
        "hosts": [
            {
                "hostId": host_id,
                "origin": origin,
                "role": "full-replica",
                "shards": ["*"],
                "firstHost": True,
            }
        ],
    }


def _host_shards(host: dict[str, Any], shard_count: int) -> set[int] | None:
    shards = host.get("shards", ["*"])
    if shards == "*" or shards == ["*"]:
        return None
    if not isinstance(shards, list):
        return set()
    assigned: set[int] = set()
    for item in shards:
        if isinstance(item, int) and 0 <= item < shard_count:
            assigned.add(item)
        elif isinstance(item, str) and item.isdigit():
            value = int(item)
            if 0 <= value < shard_count:
                assigned.add(value)
    return assigned


def validate_decree(decree: Any) -> tuple[bool, str]:
    if not isinstance(decree, dict):
        return False, "invalid_decree"
    if decree.get("v") != 1:
        return False, "unsupported_decree_version"
    if decree.get("kind") != DECREE_KIND:
        return False, "invalid_decree_kind"
    min_replicas = decree.get("minReplicas")
    if not isinstance(min_replicas, int) or min_replicas < 1 or min_replicas > 32:
        return False, "invalid_min_replicas"
    mode = decree.get("mode")
    if mode not in ("full", "sharded"):
        return False, "invalid_mode"
    shard_count = decree.get("shardCount")
    if not isinstance(shard_count, int) or shard_count < 1 or shard_count > 256:
        return False, "invalid_shard_count"
    hosts = decree.get("hosts")
    if not isinstance(hosts, list) or not hosts:
        return False, "hosts_required"
    ids: list[str] = []
    for host in hosts:
        if not isinstance(host, dict):
            return False, "invalid_host"
        host_id = host.get("hostId")
        if not isinstance(host_id, str) or not host_id.strip():
            return False, "invalid_host"
        ids.append(host_id.strip())
    if len(ids) != len(set(ids)):
        return False, "duplicate_host"
    if mode == "sharded":
        if len(hosts) < min_replicas:
            return False, "below_replica_floor"
        coverage = [0] * shard_count
        for host in hosts:
            assigned = _host_shards(host, shard_count)
            if assigned is None:
                for index in range(shard_count):
                    coverage[index] += 1
            else:
                for index in assigned:
                    coverage[index] += 1
        if any(count < min_replicas for count in coverage):
            return False, "shard_under_replicated"
    return True, "ok"


def host_should_store(
    host_id: str,
    object_id: str,
    decree: dict[str, Any],
    pinned: set[str] | None = None,
) -> bool:
    if pinned and object_id in pinned:
        return True
    if decree.get("mode") != "sharded":
        return True
    shard_count = int(decree.get("shardCount") or DEFAULT_SHARD_COUNT)
    host = next(
        (
            item
            for item in decree.get("hosts", [])
            if isinstance(item, dict) and item.get("hostId") == host_id
        ),
        None,
    )
    if host is None:
        return True
    assigned = _host_shards(host, shard_count)
    if assigned is None:
        return True
    return shard_for(object_id, shard_count) in assigned


def pin_ids_for_listing(record: dict[str, Any]) -> set[str]:
    record_id = str(record.get("id") or "").strip()
    pins: set[str] = set()
    if record_id:
        pins.add(f"listing:{record_id}")
    seller_id = str(record.get("sellerId") or "").strip()
    if seller_id:
        pins.add(f"profile:{seller_id}")
    manifest = record.get("imageManifest") or record.get("imageManifestJson")
    if isinstance(manifest, str):
        try:
            manifest = json.loads(manifest)
        except json.JSONDecodeError:
            manifest = []
    if isinstance(manifest, list):
        for item in manifest:
            if not isinstance(item, dict):
                continue
            match = MEDIA_HASH_RE.match(str(item.get("hash") or ""))
            if match:
                pins.add(f"media:{match.group(1).lower()}")
    return pins


def replica_count(object_id: str, inventories: dict[str, set[str]]) -> int:
    return sum(1 for held in inventories.values() if object_id in held)


def can_drop_object(
    host_id: str,
    object_id: str,
    inventories: dict[str, set[str]],
    decree: dict[str, Any],
    pinned: set[str] | None = None,
) -> tuple[bool, str]:
    if pinned and object_id in pinned:
        return False, "owner_pinned"
    ok, reason = validate_decree(decree)
    if not ok:
        return False, reason
    min_replicas = int(decree["minReplicas"])
    others = {
        peer_id: held
        for peer_id, held in inventories.items()
        if peer_id != host_id
    }
    if replica_count(object_id, others) < min_replicas:
        return False, "below_replica_floor"
    if decree.get("mode") == "full":
        return False, "full_mode_keeps_all_copies"
    if host_should_store(host_id, object_id, decree):
        return False, "host_still_assigned"
    return True, "ok"


def choose_host(
    object_id: str,
    hosts: list[dict[str, Any]],
    decree: dict[str, Any],
) -> dict[str, Any] | None:
    eligible = [
        host
        for host in hosts
        if isinstance(host, dict)
        and host.get("hostId")
        and host_should_store(str(host["hostId"]), object_id, decree)
    ]
    if not eligible:
        return None
    return eligible[choose_host_index(object_id, len(eligible))]


def looks_forbidden_key(key: str) -> bool:
    lowered = key.lower()
    if key in FORBIDDEN_OBJECT_KEYS or lowered in FORBIDDEN_OBJECT_KEYS:
        return True
    return any(
        marker in lowered
        for marker in ("password", "token", "secret", "cookie", "privatekey", "seed")
    )


def sanitize_public_record(kind: str, payload: Any) -> dict[str, Any]:
    if kind not in OBJECT_KINDS:
        raise ValueError("unsupported_kind")
    if not isinstance(payload, dict):
        raise ValueError("object_required")
    record_id = str(payload.get("id") or "").strip()
    if not record_id or len(record_id) > 80:
        raise ValueError("id_required")
    cleaned: dict[str, Any] = {}
    for key, value in payload.items():
        if not isinstance(key, str) or looks_forbidden_key(key):
            continue
        if key in {"imageBytes", "blob", "file", "bytes"}:
            continue
        cleaned[key] = value
    cleaned["id"] = record_id
    if kind == "listing" and not str(cleaned.get("title") or "").strip():
        raise ValueError("title_required")
    if kind == "profile" and not str(cleaned.get("displayName") or cleaned.get("sellerName") or "").strip():
        raise ValueError("display_name_required")
    return cleaned
