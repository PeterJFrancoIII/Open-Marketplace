import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("unassigned pay-to, shipping, and listing-edit files stay removed", async () => {
  const removed = [
    "app/api/shipping/quotes/route.ts",
    "lib/parcel-monkey.ts",
    "lib/payment-links.ts",
    "lib/shipping-package.ts",
    "lib/shipping-brokers.ts",
    "lib/listing-photos.ts",
    "tests/payment-links.test.mjs",
    "tests/shipping-quotes.test.mjs",
    "tests/listing-photos.test.mjs",
  ];
  for (const relative of removed) {
    assert.equal(existsSync(new URL(relative, root)), false, relative);
  }

  const marketplace = await readFile(new URL("app/marketplace.tsx", root), "utf8");
  assert.doesNotMatch(marketplace, /Pay the seller/);
  assert.doesNotMatch(marketplace, /Get estimates/);
  assert.doesNotMatch(marketplace, /parcelMonkey|pirateShip/);
  assert.doesNotMatch(marketplace, /editingListingId/);
  assert.doesNotMatch(marketplace, /photoDraftsFromExisting/);

  const listingsRoute = await readFile(
    new URL("app/api/listings/route.ts", root),
    "utf8",
  );
  assert.doesNotMatch(listingsRoute, /export async function PATCH/);
  assert.doesNotMatch(listingsRoute, /parcel-monkey|payment-links|shipping-package/);
});
