/**
 * Prove drizzle migrations on empty + upgrade + dirty-0006 paths.
 * Uses Node's built-in node:sqlite (Node ≥ 22.13).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDir = join(root, "drizzle");

function migrationFiles() {
  return readdirSync(drizzleDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

function applySql(db, sql) {
  const statements = sql
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean);
  for (const statement of statements) {
    db.exec(statement);
  }
}

function applyRange(db, fromInclusive, toInclusive) {
  const files = migrationFiles().filter((name) => {
    const n = Number(name.slice(0, 4));
    return n >= fromInclusive && n <= toInclusive;
  });
  for (const file of files) {
    applySql(db, readFileSync(join(drizzleDir, file), "utf8"));
  }
  return files.map((f) => f.slice(0, 4));
}

function assertUniqueIndex(db, indexName) {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name = ?")
    .all(indexName);
  assert.equal(rows.length, 1, `expected index ${indexName}`);
}

function seedDirtyReviewResponses(db) {
  const now = "2026-08-05T00:00:00.000Z";
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    INSERT INTO profiles (id, display_name, created_at, updated_at)
    VALUES ('p1', 'Seller', '${now}', '${now}'),
           ('p2', 'Buyer', '${now}', '${now}');
    INSERT INTO listings (
      id, title, description, price_cents, currency, condition, category,
      location_label, format, delivery, seller_id, seller_name,
      social_proofs_json, image_manifest_json
    ) VALUES (
      'l1', 'Item', 'Desc', 100, 'USD', 'Good', 'Home', 'Town',
      'Fixed price', 'Pickup', 'p1', 'Seller', '[]', '[]'
    );
    INSERT INTO transactions (
      id, listing_id, buyer_id, seller_id, status, currency, created_at, updated_at
    ) VALUES (
      't1', 'l1', 'p2', 'p1', 'review_window', 'USD', '${now}', '${now}'
    );
    INSERT INTO reviews (
      id, transaction_id, reviewer_id, subject_id, role, visibility,
      overall_score, body, created_at, updated_at
    ) VALUES (
      'r1', 't1', 'p2', 'p1', 'buyer_reviews_seller', 'revealed',
      5, 'ok', '${now}', '${now}'
    );
    INSERT INTO review_responses (id, review_id, author_id, body, created_at)
    VALUES
      ('rr1', 'r1', 'p1', 'first', '${now}'),
      ('rr2', 'r1', 'p1', 'duplicate dirty', '${now}');
  `);
}

console.log("Migration files:", migrationFiles().join(", "));

{
  const db = new DatabaseSync(":memory:");
  const applied = applyRange(db, 0, 8);
  assert.deepEqual(
    applied,
    ["0000", "0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008"],
  );
  assertUniqueIndex(db, "review_responses_one_per_review_idx");
  assertUniqueIndex(db, "social_connections_provider_subject_idx");
  console.log("PASS empty 0000→0008");
}

{
  // Fixture already at 0000; prove 0001→0008 upgrade path.
  const db = new DatabaseSync(":memory:");
  applyRange(db, 0, 0);
  applyRange(db, 1, 8);
  assertUniqueIndex(db, "review_responses_one_per_review_idx");
  console.log("PASS upgrade 0001→0008 (from 0000 fixture)");
}

{
  const db = new DatabaseSync(":memory:");
  applyRange(db, 0, 6);
  seedDirtyReviewResponses(db);
  const before = db
    .prepare("SELECT COUNT(*) AS c FROM review_responses WHERE review_id = 'r1'")
    .get();
  assert.equal(before.c, 2, "dirty fixture must have duplicate responses");
  applyRange(db, 7, 7);
  const after = db
    .prepare("SELECT COUNT(*) AS c FROM review_responses WHERE review_id = 'r1'")
    .get();
  assert.equal(after.c, 1, "0007 must dedupe before unique index");
  const kept = db
    .prepare("SELECT id FROM review_responses WHERE review_id = 'r1'")
    .get();
  assert.equal(kept.id, "rr1", "earliest response retained");
  assertUniqueIndex(db, "review_responses_one_per_review_idx");
  console.log("PASS dirty 0006→0007 dedupe");
}

console.log("All migration proofs passed.");
