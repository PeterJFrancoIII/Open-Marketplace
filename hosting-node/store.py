"""Filesystem layout for a full Open Marketplace host."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from policy import OBJECT_KINDS

HEX_RE = re.compile(r"^[a-f0-9]{64}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,80}$")


def data_root() -> Path:
    path = Path(os.environ.get("MEDIA_NODE_DATA") or os.environ.get("HOST_DATA") or "/data")
    path.mkdir(parents=True, exist_ok=True)
    (path / "media").mkdir(exist_ok=True)
    for kind in OBJECT_KINDS:
        (path / "objects" / kind).mkdir(parents=True, exist_ok=True)
    return path


def _json_path(name: str) -> Path:
    return data_root() / name


def read_json(name: str, fallback: Any) -> Any:
    path = _json_path(name)
    if not path.is_file():
        return fallback
    try:
        return json.loads(path.read_text("utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def write_json(name: str, payload: Any) -> None:
    path = _json_path(name)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=True), "utf-8")


def get_decree() -> dict[str, Any] | None:
    raw = read_json("decree.json", None)
    return raw if isinstance(raw, dict) else None


def put_decree(decree: dict[str, Any]) -> None:
    write_json("decree.json", decree)


def get_hosts() -> list[dict[str, Any]]:
    raw = read_json("hosts.json", [])
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict) and item.get("hostId")]


def put_hosts(hosts: list[dict[str, Any]]) -> None:
    write_json("hosts.json", hosts)


def upsert_host(host: dict[str, Any]) -> list[dict[str, Any]]:
    host_id = str(host.get("hostId") or "").strip()
    if not host_id:
        raise ValueError("hostId_required")
    hosts = [item for item in get_hosts() if item.get("hostId") != host_id]
    next_host = {**host, "hostId": host_id}
    hosts.append(next_host)
    put_hosts(hosts)
    return hosts


def object_path(kind: str, record_id: str) -> Path:
    if kind not in OBJECT_KINDS or not SAFE_ID_RE.fullmatch(record_id):
        raise ValueError("invalid_object")
    return data_root() / "objects" / kind / f"{record_id}.json"


def put_object(kind: str, record_id: str, payload: dict[str, Any]) -> None:
    path = object_path(kind, record_id)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=True), "utf-8")


def get_object(kind: str, record_id: str) -> dict[str, Any] | None:
    try:
        path = object_path(kind, record_id)
    except ValueError:
        return None
    if not path.is_file():
        return None
    try:
        raw = json.loads(path.read_text("utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return raw if isinstance(raw, dict) else None


def delete_object(kind: str, record_id: str) -> bool:
    try:
        path = object_path(kind, record_id)
    except ValueError:
        return False
    if not path.is_file():
        return False
    path.unlink()
    return True


def list_objects(kind: str) -> list[dict[str, Any]]:
    if kind not in OBJECT_KINDS:
        return []
    folder = data_root() / "objects" / kind
    records: list[dict[str, Any]] = []
    for path in sorted(folder.glob("*.json")):
        try:
            raw = json.loads(path.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(raw, dict) and raw.get("id"):
            records.append(raw)
    return records


def inventory() -> dict[str, list[str]]:
    return {
        kind: [str(item["id"]) for item in list_objects(kind)]
        for kind in OBJECT_KINDS
    }


def media_path(hex_digest: str) -> Path:
    if not HEX_RE.fullmatch(hex_digest):
        raise ValueError("invalid_hash")
    nested = data_root() / "media" / hex_digest
    legacy = data_root() / hex_digest
    if nested.is_file():
        return nested
    if legacy.is_file():
        return legacy
    return nested


def list_media_hashes() -> list[str]:
    hashes: list[str] = []
    root = data_root()
    folders = [root, root / "media"]
    for folder in folders:
        if not folder.is_dir():
            continue
        for path in folder.iterdir():
            if path.is_file() and HEX_RE.fullmatch(path.name):
                hashes.append(path.name)
    return sorted(set(hashes))


def counts() -> dict[str, int]:
    tallies = {kind: len(list_objects(kind)) for kind in OBJECT_KINDS}
    tallies["media"] = len(list_media_hashes())
    return tallies
