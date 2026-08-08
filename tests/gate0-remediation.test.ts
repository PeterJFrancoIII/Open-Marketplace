import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildSignedTrustBundle,
  generateRegistryKeyPair,
  signCanonical,
  verifyTrustBundle,
  verifyTrustEventEnvelope,
} from "../lib/trust/portable/index.ts";
import { canonicalize, sha256Hex } from "../lib/trust/portable/canonicalize.ts";
import { TRUST_ENVELOPE_SCHEMA_V1 } from "../lib/trust/types.ts";
import { priorForEnvelope } from "../lib/trust/prior-hash.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDir = join(root, "drizzle");

function migrationFiles() {
  return readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function applyRange(db: DatabaseSync, fromInclusive: number, toInclusive: number) {
  for (const file of migrationFiles()) {
    const n = Number(file.slice(0, 4));
    if (n < fromInclusive || n > toInclusive) continue;
    const sql = readFileSync(join(drizzleDir, file), "utf8");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean)) {
      db.exec(statement);
    }
  }
}

async function signV1PayloadHashChain(input: {
  privateKey: CryptoKey;
  eventId: string;
  subjectProfileId: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
  priorPayloadHash?: string;
  registryId: string;
}) {
  const payloadHash = await sha256Hex(canonicalize(input.payload));
  const body = {
    eventId: input.eventId,
    subjectProfileId: input.subjectProfileId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    payloadHash,
    priorEventHash: priorForEnvelope(input.priorPayloadHash),
    registryId: input.registryId,
    schemaVersion: TRUST_ENVELOPE_SCHEMA_V1,
  };
  const signature = await signCanonical(input.privateKey, body);
  return { ...body, signature };
}

test("gate0: 0009 preserves signed v1 chain and genesis round-trips", async () => {
  const keys = await generateRegistryKeyPair();
  const first = await signV1PayloadHashChain({
    privateKey: keys.privateKey,
    eventId: "e1",
    subjectProfileId: "p1",
    eventType: "projection.rebuilt",
    occurredAt: "2026-08-05T00:00:00.000Z",
    payload: { n: 1 },
    registryId: "registry-test",
  });
  const second = await signV1PayloadHashChain({
    privateKey: keys.privateKey,
    eventId: "e2",
    subjectProfileId: "p1",
    eventType: "review.sealed",
    occurredAt: "2026-08-05T01:00:00.000Z",
    payload: { n: 2 },
    priorPayloadHash: first.payloadHash,
    registryId: "registry-test",
  });

  assert.equal(
    await verifyTrustEventEnvelope({ envelope: first, publicKey: keys.publicKey }),
    true,
  );
  assert.equal(
    await verifyTrustEventEnvelope({ envelope: second, publicKey: keys.publicKey }),
    true,
  );

  const db = new DatabaseSync(":memory:");
  applyRange(db, 0, 8);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    INSERT INTO profiles (id, display_name, created_at, updated_at)
    VALUES ('p1', 'Seller', '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:00.000Z');
  `);
  db.prepare(
    `INSERT INTO trust_events (
      id, subject_profile_id, event_type, occurred_at, payload_hash,
      prior_event_hash, registry_id, schema_version, signature
    ) VALUES (?, 'p1', ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    first.eventId,
    first.eventType,
    first.occurredAt,
    first.payloadHash,
    first.priorEventHash ?? null,
    first.registryId,
    first.signature,
  );
  db.prepare(
    `INSERT INTO trust_events (
      id, subject_profile_id, event_type, occurred_at, payload_hash,
      prior_event_hash, registry_id, schema_version, signature
    ) VALUES (?, 'p1', ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    second.eventId,
    second.eventType,
    second.occurredAt,
    second.payloadHash,
    second.priorEventHash ?? null,
    second.registryId,
    second.signature,
  );

  applyRange(db, 9, 9);
  const rows = db
    .prepare(
      `SELECT id, prior_event_hash, prior_event_id, payload_hash, signature, schema_version
       FROM trust_events ORDER BY occurred_at`,
    )
    .all() as Array<{
      id: string;
      prior_event_hash: string;
      prior_event_id: string;
      payload_hash: string;
      signature: string;
      schema_version: number;
    }>;

  assert.equal(rows.length, 2);
  assert.equal(rows[0].prior_event_hash, "");
  assert.equal(rows[0].prior_event_id, "");
  assert.equal(rows[1].prior_event_hash, first.payloadHash);
  assert.equal(rows[1].prior_event_id, first.eventId);

  const exported = rows.map((row) => ({
    eventId: row.id,
    subjectProfileId: "p1",
    eventType: row.id === first.eventId ? first.eventType : second.eventType,
    occurredAt: row.id === first.eventId ? first.occurredAt : second.occurredAt,
    payloadHash: row.payload_hash,
    priorEventHash: row.prior_event_hash || undefined,
    priorEventId: row.prior_event_id || undefined,
    registryId: "registry-test",
    schemaVersion: row.schema_version,
    signature: row.signature,
  }));

  assert.equal(
    await verifyTrustEventEnvelope({
      envelope: exported[0]!,
      publicKey: keys.publicKey,
    }),
    true,
    "genesis must verify after DB round trip with omitted prior",
  );
  assert.equal(
    await verifyTrustEventEnvelope({
      envelope: exported[1]!,
      publicKey: keys.publicKey,
    }),
    true,
    "second v1 event must still verify — prior_event_hash untouched",
  );

  const bundle = await buildSignedTrustBundle({
    registryId: "registry-test",
    keyId: keys.keyId,
    privateKey: keys.privateKey,
    subjectProfileId: "p1",
    events: exported,
    snapshot: {
      memberSince: "2024-01-01T00:00:00.000Z",
      sellerCompletedSales: 0,
      sellerDisplayMean: null,
      sellerRatingCount: 0,
      buyerDisplayMean: null,
      buyerRatingCount: 0,
    },
  });
  const verified = await verifyTrustBundle({
    bundle,
    publicKey: keys.publicKey,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.eventsValid, true);
});

test("gate0: verifyTrustBundle rejects two independently signed roots", async () => {
  const keys = await generateRegistryKeyPair();
  const a = await signV1PayloadHashChain({
    privateKey: keys.privateKey,
    eventId: "root-a",
    subjectProfileId: "p1",
    eventType: "projection.rebuilt",
    occurredAt: "2026-08-05T00:00:00.000Z",
    payload: { root: "a" },
    registryId: "registry-test",
  });
  const b = await signV1PayloadHashChain({
    privateKey: keys.privateKey,
    eventId: "root-b",
    subjectProfileId: "p1",
    eventType: "projection.rebuilt",
    occurredAt: "2026-08-05T00:00:01.000Z",
    payload: { root: "b" },
    registryId: "registry-test",
  });

  const bundle = await buildSignedTrustBundle({
    registryId: "registry-test",
    keyId: keys.keyId,
    privateKey: keys.privateKey,
    subjectProfileId: "p1",
    events: [a, b],
    snapshot: {
      memberSince: "2024-01-01T00:00:00.000Z",
      sellerCompletedSales: 0,
      sellerDisplayMean: null,
      sellerRatingCount: 0,
      buyerDisplayMean: null,
      buyerRatingCount: 0,
    },
  });

  const verified = await verifyTrustBundle({
    bundle,
    publicKey: keys.publicKey,
  });
  assert.equal(verified.ok, false);
  assert.equal(verified.eventsValid, false);
  assert.ok(verified.reasons.some((r) => /exactly one root/i.test(r)));
});

test("gate0: seal path source batches review.sealed with projection.rebuilt", () => {
  const source = readFileSync(
    join(root, "app/api/transactions/[id]/reviews/route.ts"),
    "utf8",
  );
  assert.match(source, /eventType:\s*"review\.sealed"/);
  assert.match(source, /eventType:\s*"projection\.rebuilt"/);
  assert.match(source, /commitAtomicTrustBatch/);
  assert.match(source, /projectionUpsertQuery/);
  // Lone seal must not stop at review.sealed tip without projection rebuild.
  assert.doesNotMatch(
    source,
    /commitWithSignedTrustEvent\(\{\s*subjectProfileId:\s*sealed\.subjectId/s,
  );
});

test("gate0: audit allowlist fails closed without real npm audit JSON", () => {
  const script = join(root, "scripts/audit-allowlist.mjs");
  const dir = mkdtempSync(join(tmpdir(), "audit-allowlist-"));
  writeFileSync(
    join(dir, "audit-allowlist.mjs"),
    readFileSync(script, "utf8").replace(
      'spawnSync("npm", ["audit", "--omit=dev", "--json"]',
      'spawnSync("false", []',
    ),
  );
  // Point advisory path by running from repo root but with broken npm substitute.
  const broken = spawnSync(process.execPath, [script], {
    cwd: root,
    env: {
      ...process.env,
      PATH: `${dir}:/usr/bin:/bin`,
    },
    encoding: "utf8",
  });
  // When PATH shadows npm with a non-audit binary, status must be non-zero.
  // Create a fake npm that exits 2 with empty stdout.
  writeFileSync(
    join(dir, "npm"),
    `#!/bin/sh\necho ''\nexit 2\n`,
    { mode: 0o755 },
  );
  const empty = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    encoding: "utf8",
  });
  assert.notEqual(empty.status, 0);
  assert.match(`${empty.stderr}\n${empty.stdout}`, /FAIL|non-audit|empty/i);
  void broken;

  writeFileSync(
    join(dir, "npm"),
    `#!/bin/sh\necho '{"vulnerabilities":{"evil":{"severity":"critical","via":[{"url":"https://github.com/advisories/GHSA-0000-0000-0000","severity":"critical","range":"*"}],"range":"*"}}}'\nexit 1\n`,
    { mode: 0o755 },
  );
  const mismatch = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    encoding: "utf8",
  });
  assert.notEqual(mismatch.status, 0);
  assert.match(`${mismatch.stderr}\n${mismatch.stdout}`, /allowlist mismatch|unexpected/i);
});

test("gate0: live audit-allowlist binds advisory ids from docs", () => {
  const result = spawnSync(process.execPath, [join(root, "scripts/audit-allowlist.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PASS/);
  const docs = readFileSync(join(root, "docs/dependency-advisories.md"), "utf8");
  assert.match(docs, /GHSA-6gpp-xcg3-4w24/);
  assert.match(docs, /affected_range/);
});
