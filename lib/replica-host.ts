import {
  parseMediaNodeOrigin,
  readMediaNodeConfig,
  type MediaNodeConfig,
} from "./media-node";
import {
  chooseHost,
  type HostDecree,
  type ReplicaHostRecord,
  validateDecree,
} from "./replica-policy";
import type { Listing } from "./types";

export type ReplicaStatus = {
  ok: boolean;
  role: string;
  hostId: string;
  minReplicas: number;
  mode: "full" | "sharded";
  hostCount: number;
  counts?: { listing?: number; profile?: number; media?: number };
  scaleDownReady?: boolean;
  decreeIssuedBy?: string;
};

export function publicListingRecord(listing: Listing): Record<string, unknown> {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    priceCents: listing.priceCents,
    currency: listing.currency,
    condition: listing.condition,
    category: listing.category,
    locationLabel: listing.locationLabel,
    distanceMiles: listing.distanceMiles,
    format: listing.format,
    delivery: listing.delivery,
    sellerId: listing.sellerId,
    sellerName: listing.sellerName,
    itemsSold: listing.itemsSold ?? 0,
    sellerRating: listing.sellerRating ?? null,
    sellerRatingCount: listing.sellerRatingCount ?? 0,
    buyerRating: listing.buyerRating ?? null,
    buyerRatingCount: listing.buyerRatingCount ?? 0,
    socialProofs: listing.socialProofs,
    imageManifest: listing.imageManifest,
    paymentDestinations: listing.paymentDestinations ?? [],
    shippingPackage: listing.shippingPackage ?? null,
    createdAt: listing.createdAt,
    endingAt: listing.endingAt,
  };
}

export function publicProfileRecord(listing: Listing): Record<string, unknown> {
  return {
    id: listing.sellerId,
    displayName: listing.sellerName,
    sellerName: listing.sellerName,
    socialProofs: listing.socialProofs,
    paymentDestinations: listing.paymentDestinations ?? [],
    itemsSold: listing.itemsSold ?? 0,
    sellerRating: listing.sellerRating ?? null,
    sellerRatingCount: listing.sellerRatingCount ?? 0,
    buyerRating: listing.buyerRating ?? null,
    buyerRatingCount: listing.buyerRatingCount ?? 0,
  };
}

export async function fetchReplicaStatus(
  origin: string,
): Promise<ReplicaStatus | null> {
  const parsed = parseMediaNodeOrigin(origin);
  if (!parsed) return null;
  const response = await fetch(`${parsed}/v1/status`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Partial<ReplicaStatus>;
  if (body.ok !== true) return null;
  if (body.role !== "full-replica" && body.role !== "trusted-media-node") {
    return null;
  }
  return {
    ok: true,
    role: String(body.role),
    hostId: String(body.hostId ?? ""),
    minReplicas: Number(body.minReplicas ?? 3),
    mode: body.mode === "sharded" ? "sharded" : "full",
    hostCount: Number(body.hostCount ?? 1),
    counts: body.counts,
    scaleDownReady: Boolean(body.scaleDownReady),
    decreeIssuedBy: body.decreeIssuedBy ? String(body.decreeIssuedBy) : undefined,
  };
}

export async function fetchReplicaHosts(
  origin: string,
): Promise<ReplicaHostRecord[]> {
  const parsed = parseMediaNodeOrigin(origin);
  if (!parsed) return [];
  const response = await fetch(`${parsed}/v1/hosts`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { hosts?: ReplicaHostRecord[] };
  return Array.isArray(body.hosts) ? body.hosts : [];
}

export async function fetchReplicaDecree(origin: string): Promise<HostDecree | null> {
  const parsed = parseMediaNodeOrigin(origin);
  if (!parsed) return null;
  const response = await fetch(`${parsed}/v1/decree`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { decree?: unknown };
  const valid = validateDecree(body.decree);
  return valid.ok ? (body.decree as HostDecree) : null;
}

export async function fetchReplicaCatalog(
  origin: string,
): Promise<{ listings: Record<string, unknown>[] }> {
  const parsed = parseMediaNodeOrigin(origin);
  if (!parsed) return { listings: [] };
  const hosts = await fetchReplicaHosts(parsed);
  const decree = await fetchReplicaDecree(parsed);
  const chosen =
    decree && hosts.length
      ? chooseHost("catalog", hosts, decree)?.origin
      : parsed;
  const target = parseMediaNodeOrigin(chosen ?? parsed) ?? parsed;
  const response = await fetch(`${target}/v1/catalog`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    if (target !== parsed) {
      const fallback = await fetch(`${parsed}/v1/catalog`, {
        headers: { accept: "application/json" },
      });
      if (!fallback.ok) return { listings: [] };
      const fallbackBody = (await fallback.json()) as {
        listings?: Record<string, unknown>[];
      };
      return { listings: Array.isArray(fallbackBody.listings) ? fallbackBody.listings : [] };
    }
    return { listings: [] };
  }
  const body = (await response.json()) as { listings?: Record<string, unknown>[] };
  return { listings: Array.isArray(body.listings) ? body.listings : [] };
}

export async function publishReplicaObject(
  config: MediaNodeConfig,
  kind: "listing" | "profile",
  record: Record<string, unknown>,
): Promise<void> {
  const origin = parseMediaNodeOrigin(config.origin);
  const id = String(record.id ?? "").trim();
  if (!origin || !id) return;
  if (!config.writeToken.trim()) return;
  const response = await fetch(`${origin}/v1/objects/${kind}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${config.writeToken.trim()}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ object: record }),
  });
  if (!response.ok) {
    throw new Error("The first database host rejected a public record copy.");
  }
}

export async function publishReplicaSnapshot(listing: Listing): Promise<void> {
  const config = readMediaNodeConfig();
  if (!config?.writeToken) return;
  await publishReplicaObject(config, "listing", publicListingRecord(listing));
  await publishReplicaObject(config, "profile", publicProfileRecord(listing));
}

export function replicaStatusSummary(status: ReplicaStatus): string {
  const copies = `${status.hostCount} host${status.hostCount === 1 ? "" : "s"}`;
  const floor = `minimum ${status.minReplicas} copies`;
  if (status.mode === "full") {
    return `${copies} online. Each host keeps a full copy until ${floor} exist and Main issues a scale-down decree.`;
  }
  return `${copies} online in sharded mode. Scale-down is allowed only while ${floor} remain.`;
}
