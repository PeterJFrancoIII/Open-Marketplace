export const DEFAULT_MIN_REPLICAS = 3;
export const DEFAULT_SHARD_COUNT = 16;
export const FIRST_HOST_ID = "open-marketplace-first-public-database-host";
export const DECREE_KIND = "open-marketplace-host-decree";
export const OBJECT_KINDS = ["listing", "profile"] as const;

export type ReplicaMode = "full" | "sharded";
export type ReplicaObjectKind = (typeof OBJECT_KINDS)[number];

export type ReplicaHostRecord = {
  hostId: string;
  origin?: string;
  role?: string;
  shards?: Array<number | string>;
  firstHost?: boolean;
};

export type HostDecree = {
  v: 1;
  kind: typeof DECREE_KIND;
  issuedAt: string;
  issuedBy: string;
  minReplicas: number;
  mode: ReplicaMode;
  shardCount: number;
  hosts: ReplicaHostRecord[];
};

export function fnv1a32(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shardFor(
  objectId: string,
  shardCount = DEFAULT_SHARD_COUNT,
): number {
  if (shardCount < 1) return 0;
  return fnv1a32(objectId) % shardCount;
}

export function chooseHostIndex(objectId: string, hostCount: number): number {
  if (hostCount < 1) return -1;
  return fnv1a32(objectId) % hostCount;
}

export function genesisDecree(
  hostId: string,
  origin = "",
  minReplicas = DEFAULT_MIN_REPLICAS,
): HostDecree {
  return {
    v: 1,
    kind: DECREE_KIND,
    issuedAt: "",
    issuedBy: "bootstrap",
    minReplicas,
    mode: "full",
    shardCount: DEFAULT_SHARD_COUNT,
    hosts: [
      {
        hostId,
        origin,
        role: "full-replica",
        shards: ["*"],
        firstHost: true,
      },
    ],
  };
}

function hostShards(
  host: ReplicaHostRecord,
  shardCount: number,
): Set<number> | null {
  const shards = host.shards ?? ["*"];
  if (shards.length === 1 && shards[0] === "*") return null;
  const assigned = new Set<number>();
  for (const item of shards) {
    const value = typeof item === "number" ? item : Number.parseInt(String(item), 10);
    if (Number.isInteger(value) && value >= 0 && value < shardCount) {
      assigned.add(value);
    }
  }
  return assigned;
}

export function validateDecree(decree: unknown): { ok: boolean; reason: string } {
  if (!decree || typeof decree !== "object") {
    return { ok: false, reason: "invalid_decree" };
  }
  const value = decree as Partial<HostDecree>;
  if (value.v !== 1) return { ok: false, reason: "unsupported_decree_version" };
  if (value.kind !== DECREE_KIND) return { ok: false, reason: "invalid_decree_kind" };
  if (
    !Number.isInteger(value.minReplicas) ||
    Number(value.minReplicas) < 1 ||
    Number(value.minReplicas) > 32
  ) {
    return { ok: false, reason: "invalid_min_replicas" };
  }
  if (value.mode !== "full" && value.mode !== "sharded") {
    return { ok: false, reason: "invalid_mode" };
  }
  if (
    !Number.isInteger(value.shardCount) ||
    Number(value.shardCount) < 1 ||
    Number(value.shardCount) > 256
  ) {
    return { ok: false, reason: "invalid_shard_count" };
  }
  if (!Array.isArray(value.hosts) || value.hosts.length === 0) {
    return { ok: false, reason: "hosts_required" };
  }
  const ids = value.hosts.map((host) => String(host?.hostId ?? "").trim());
  if (ids.some((id) => !id)) return { ok: false, reason: "invalid_host" };
  if (new Set(ids).size !== ids.length) return { ok: false, reason: "duplicate_host" };
  if (value.mode === "sharded") {
    if (value.hosts.length < Number(value.minReplicas)) {
      return { ok: false, reason: "below_replica_floor" };
    }
    const coverage = Array.from({ length: Number(value.shardCount) }, () => 0);
    for (const host of value.hosts) {
      const assigned = hostShards(host, Number(value.shardCount));
      if (assigned == null) {
        for (let index = 0; index < coverage.length; index += 1) coverage[index] += 1;
      } else {
        for (const shard of assigned) coverage[shard] += 1;
      }
    }
    if (coverage.some((count) => count < Number(value.minReplicas))) {
      return { ok: false, reason: "shard_under_replicated" };
    }
  }
  return { ok: true, reason: "ok" };
}

export function hostShouldStore(
  hostId: string,
  objectId: string,
  decree: HostDecree,
): boolean {
  if (decree.mode !== "sharded") return true;
  const host = decree.hosts.find((item) => item.hostId === hostId);
  if (!host) return true;
  const assigned = hostShards(host, decree.shardCount);
  if (assigned == null) return true;
  return assigned.has(shardFor(objectId, decree.shardCount));
}

export function replicaCount(
  objectId: string,
  inventories: Record<string, Iterable<string>>,
): number {
  return Object.values(inventories).filter((held) => new Set(held).has(objectId))
    .length;
}

export function canDropObject(
  hostId: string,
  objectId: string,
  inventories: Record<string, Iterable<string>>,
  decree: HostDecree,
): { ok: boolean; reason: string } {
  const valid = validateDecree(decree);
  if (!valid.ok) return valid;
  const others: Record<string, Iterable<string>> = {};
  for (const [peerId, held] of Object.entries(inventories)) {
    if (peerId !== hostId) others[peerId] = held;
  }
  if (replicaCount(objectId, others) < decree.minReplicas) {
    return { ok: false, reason: "below_replica_floor" };
  }
  if (decree.mode === "full") {
    return { ok: false, reason: "full_mode_keeps_all_copies" };
  }
  if (hostShouldStore(hostId, objectId, decree)) {
    return { ok: false, reason: "host_still_assigned" };
  }
  return { ok: true, reason: "ok" };
}

export function chooseHost(
  objectId: string,
  hosts: ReplicaHostRecord[],
  decree: HostDecree,
): ReplicaHostRecord | null {
  const eligible = hosts.filter(
    (host) => host.hostId && hostShouldStore(host.hostId, objectId, decree),
  );
  if (!eligible.length) return null;
  return eligible[chooseHostIndex(objectId, eligible.length)] ?? null;
}

export function assignShardsForScaleDown(
  hostIds: string[],
  minReplicas = DEFAULT_MIN_REPLICAS,
  shardCount = DEFAULT_SHARD_COUNT,
): ReplicaHostRecord[] | null {
  if (hostIds.length < minReplicas) return null;
  return hostIds.map((hostId, hostIndex) => ({
    hostId,
    role: "full-replica",
    shards: Array.from({ length: shardCount }, (_, shard) => shard).filter(
      (shard) =>
        Array.from({ length: minReplicas }, (__, copy) => {
          return (shard + copy) % hostIds.length === hostIndex;
        }).some(Boolean),
    ),
  }));
}
