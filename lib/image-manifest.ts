import { mediaHashHex, parseMediaNodeOrigin } from "./media-node.ts";
import type { MediaManifest } from "./types";

export function sanitizeMediaHosts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const origins: string[] = [];
  for (const item of value.slice(0, 8)) {
    const origin = parseMediaNodeOrigin(String(item ?? ""));
    if (origin && !origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

export function attachMediaHosts(
  manifest: MediaManifest,
  origins: string[],
): MediaManifest {
  const hosts = sanitizeMediaHosts([...(manifest.hosts ?? []), ...origins]);
  return hosts.length ? { ...manifest, hosts } : { ...manifest };
}

export function publicMediaOriginsFromManifests(
  manifests: MediaManifest[],
): string[] {
  return sanitizeMediaHosts(manifests.flatMap((item) => item.hosts ?? []));
}

export function sanitizeImageManifest(value: unknown): MediaManifest[] {
  if (!Array.isArray(value)) return [];
  const manifests: MediaManifest[] = [];
  for (const item of value.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const hex = mediaHashHex(String(row.hash ?? ""));
    if (!hex) continue;
    const size = Number(row.size ?? 0);
    manifests.push({
      hash: `sha256:${hex}`,
      name: String(row.name ?? "photo").trim().slice(0, 120) || "photo",
      size: Number.isFinite(size) && size >= 0 ? Math.min(size, 12_000_000) : 0,
      type: String(row.type ?? "application/octet-stream").trim().slice(0, 80) ||
        "application/octet-stream",
      hosts: sanitizeMediaHosts(row.hosts),
    });
  }
  return manifests;
}
