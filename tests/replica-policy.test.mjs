import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FIRST_HOST_ID,
  assignShardsForScaleDown,
  canDropObject,
  chooseHost,
  chooseHostIndex,
  genesisDecree,
  validateDecree,
} from "../lib/replica-policy.ts";

test("first host genesis stays in full-copy mode with a 3-copy floor", () => {
  const decree = genesisDecree(FIRST_HOST_ID, "https://nas.example");
  assert.equal(validateDecree(decree).ok, true);
  assert.equal(decree.minReplicas, 3);
  assert.equal(decree.mode, "full");
  assert.equal(decree.hosts[0].firstHost, true);
});

test("Main cannot shard until the replica floor is met", () => {
  const tooSoon = genesisDecree(FIRST_HOST_ID);
  tooSoon.mode = "sharded";
  assert.deepEqual(validateDecree(tooSoon), {
    ok: false,
    reason: "below_replica_floor",
  });
  assert.equal(assignShardsForScaleDown([FIRST_HOST_ID], 3), null);

  const hosts = assignShardsForScaleDown(["a", "b", "c"], 3, 8);
  assert.ok(hosts);
  const ready = {
    v: 1,
    kind: "open-marketplace-host-decree",
    issuedAt: "",
    issuedBy: "main",
    minReplicas: 3,
    mode: "sharded",
    shardCount: 8,
    hosts,
  };
  assert.equal(validateDecree(ready).ok, true);
});

test("hosts refuse to drop the last copies", () => {
  const decree = genesisDecree(FIRST_HOST_ID);
  const blocked = canDropObject(
    FIRST_HOST_ID,
    "listing:one",
    { [FIRST_HOST_ID]: ["listing:one"] },
    decree,
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "below_replica_floor");
});

test("adding hosts automatically spreads read load", () => {
  assert.equal(chooseHostIndex("listing-42", 1), 0);
  const decree = genesisDecree("a");
  decree.hosts = [
    { hostId: "a", origin: "https://a.example" },
    { hostId: "b", origin: "https://b.example" },
    { hostId: "c", origin: "https://c.example" },
  ];
  const chosen = new Set(
    ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"].map(
      (id) => chooseHost(id, decree.hosts, decree)?.hostId,
    ),
  );
  assert.ok(chosen.size > 1);
});

test("account settings describe the first full host and keep secrets off it", async () => {
  const settings = await readFile(
    new URL("../app/account/account-settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(settings, /First database host/);
  assert.match(settings, /open-marketplace-first-public-database-host/);
  assert.match(settings, /Synology Arch Linux/);
  assert.match(settings, /Passwords and Facebook tokens/);
  assert.match(settings, /scale-down decree/);
  assert.doesNotMatch(settings, /filled from Facebook/);

  const server = await readFile(
    new URL("../hosting-node/server.py", import.meta.url),
    "utf8",
  );
  const hostPolicy = await readFile(
    new URL("../hosting-node/policy.py", import.meta.url),
    "utf8",
  );
  assert.match(server, /full-replica/);
  assert.match(hostPolicy, /FIRST_HOST_ID = "open-marketplace-first-public-database-host"/);
  assert.match(
    await readFile(new URL("../hosting-node/compose.yaml", import.meta.url), "utf8"),
    /container_name: open-marketplace-first-public-database-host/,
  );
  assert.match(hostPolicy, /below_replica_floor/);
  assert.doesNotMatch(server, /BETTER_AUTH_SECRET|FACEBOOK_CLIENT_SECRET/);
  assert.doesNotMatch(hostPolicy, /BETTER_AUTH_SECRET|FACEBOOK_CLIENT_SECRET/);

  const listings = await readFile(
    new URL("../app/api/listings/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(listings, /image bytes|arrayBuffer|multipart/);
});
