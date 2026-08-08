import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { OAUTH_PERSIST_BATCH_ORDER } from "../lib/trust/oauth/persist-order.ts";
import { canonicalize, sha256Hex } from "../lib/trust/portable/canonicalize.ts";
import {
  generateRegistryKeyPair,
  signCanonical,
  verifyCanonical,
} from "../lib/trust/portable/keys.ts";
import { normalizePriorEventHash } from "../lib/trust/prior-hash.ts";
import { buildSignedTrustEvent } from "../lib/trust/signed-events.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDir = join(root, "drizzle");

function migrationFiles() {
  return readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function applyAllMigrations(db: DatabaseSync) {
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(drizzleDir, file), "utf8");
    for (const statement of sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean)) {
      db.exec(statement);
    }
  }
}

function seedProfile(db: DatabaseSync, id = "profile-1") {
  const now = "2026-08-07T00:00:00.000Z";
  db.exec(`
    INSERT INTO profiles (id, display_name, created_at, updated_at)
    VALUES ('${id}', 'Seller', '${now}', '${now}');
  `);
}

test("oauth persist order is profile → connection → grant", () => {
  assert.deepEqual([...OAUTH_PERSIST_BATCH_ORDER], [
    "profiles",
    "social_connections",
    "provider_grants",
  ]);
});

test("D1-style sequential batch: grant before connection fails FK", () => {
  const db = new DatabaseSync(":memory:");
  applyAllMigrations(db);
  db.exec("PRAGMA foreign_keys = ON;");
  seedProfile(db);
  const now = "2026-08-07T00:00:00.000Z";

  assert.throws(() => {
    // Wrong order (historical bug): grant references missing connection.
    db.exec(`
      INSERT INTO provider_grants (
        id, profile_id, social_connection_id, provider, provider_subject_hash,
        grant_kid, grant_iv, grant_ciphertext, granted_scopes_json, status,
        created_at, updated_at
      ) VALUES (
        'g1', 'profile-1', 'sc1', 'facebook', 'subj',
        'kid', 'iv', 'cipher', '[]', 'active', '${now}', '${now}'
      );
    `);
  }, /FOREIGN KEY/i);
});

test("D1-style sequential batch: connection before grant succeeds", () => {
  const db = new DatabaseSync(":memory:");
  applyAllMigrations(db);
  db.exec("PRAGMA foreign_keys = ON;");
  seedProfile(db);
  const now = "2026-08-07T00:00:00.000Z";

  db.exec(`
    INSERT INTO social_connections (
      id, profile_id, provider, provider_subject_hash, canonical_url, status,
      created_at, updated_at
    ) VALUES (
      'sc1', 'profile-1', 'facebook', 'subj', 'https://facebook.com/x', 'oauth_verified',
      '${now}', '${now}'
    );
    INSERT INTO provider_grants (
      id, profile_id, social_connection_id, provider, provider_subject_hash,
      grant_kid, grant_iv, grant_ciphertext, granted_scopes_json, status,
      created_at, updated_at
    ) VALUES (
      'g1', 'profile-1', 'sc1', 'facebook', 'subj',
      'kid', 'iv', 'cipher', '[]', 'active', '${now}', '${now}'
    );
  `);
  const row = db
    .prepare("SELECT social_connection_id AS id FROM provider_grants WHERE id='g1'")
    .get() as { id: string };
  assert.equal(row.id, "sc1");
});

test("projection provenance binds payloadJson hash to verified signature", async () => {
  const keys = await generateRegistryKeyPair();
  process.env.REGISTRY_SIGNING_PRIVATE_JWK = JSON.stringify(keys.privateJwk);
  process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK = JSON.stringify(keys.publicJwk);
  process.env.NEXT_PUBLIC_REGISTRY_ID = "open-marketplace-test";

  const payload = {
    projectionVersion: "v1",
    seller: { completedSales: 2, displayMean: null, ratingCount: 0 },
    buyer: null,
    experienceLabel: "New",
  };
  const envelope = await buildSignedTrustEvent({
    eventId: "evt-1",
    subjectProfileId: "profile-1",
    eventType: "projection.rebuilt",
    occurredAt: "2026-08-07T00:00:00.000Z",
    payload,
    priorEventHash: null,
  });

  const bound = await sha256Hex(canonicalize(payload));
  assert.equal(envelope.payloadHash, bound);

  const { signature, ...body } = envelope;
  assert.equal(await verifyCanonical(keys.publicKey, body, signature), true);

  const tampered = { ...payload, seller: { ...payload.seller, completedSales: 99 } };
  assert.notEqual(await sha256Hex(canonicalize(tampered)), envelope.payloadHash);

  const badSig = await signCanonical(keys.privateKey, { ...body, eventId: "other" });
  assert.equal(await verifyCanonical(keys.publicKey, body, badSig), false);
});

test("identical projection payloads can chain via prior event id", async () => {
  const keys = await generateRegistryKeyPair();
  process.env.REGISTRY_SIGNING_PRIVATE_JWK = JSON.stringify(keys.privateJwk);
  process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK = JSON.stringify(keys.publicJwk);
  process.env.NEXT_PUBLIC_REGISTRY_ID = "open-marketplace-test";

  const payload = {
    projectionVersion: "v1",
    seller: { completedSales: 2, displayMean: null, ratingCount: 0 },
    buyer: null,
    experienceLabel: "New",
  };
  const first = await buildSignedTrustEvent({
    eventId: "evt-a",
    subjectProfileId: "profile-1",
    eventType: "projection.rebuilt",
    occurredAt: "2026-08-07T00:00:00.000Z",
    payload,
    priorEventHash: null,
  });
  const second = await buildSignedTrustEvent({
    eventId: "evt-b",
    subjectProfileId: "profile-1",
    eventType: "projection.rebuilt",
    occurredAt: "2026-08-07T00:00:00.000Z",
    payload,
    priorEventHash: first.eventId,
  });
  assert.equal(first.payloadHash, second.payloadHash);
  assert.equal(second.priorEventId, first.eventId);
  assert.notEqual(first.eventId, second.eventId);
});

test("prior-event-id unique index rejects concurrent chain forks", () => {
  const db = new DatabaseSync(":memory:");
  applyAllMigrations(db);
  db.exec("PRAGMA foreign_keys = ON;");
  seedProfile(db);
  const now = "2026-08-07T00:00:00.000Z";
  db.exec(`
    INSERT INTO trust_events (
      id, subject_profile_id, event_type, occurred_at, payload_hash,
      prior_event_hash, prior_event_id, registry_id, schema_version, signature
    ) VALUES (
      'e1', 'profile-1', 'projection.rebuilt', '${now}', 'hash-a',
      '', '${normalizePriorEventHash(null)}', 'reg', 2, 'sig'
    );
  `);
  assert.throws(() => {
    db.exec(`
      INSERT INTO trust_events (
        id, subject_profile_id, event_type, occurred_at, payload_hash,
        prior_event_hash, prior_event_id, registry_id, schema_version, signature
      ) VALUES (
        'e2', 'profile-1', 'review.revealed', '${now}', 'hash-b',
        '', '', 'reg', 2, 'sig'
      );
    `);
  }, /UNIQUE/i);
});
