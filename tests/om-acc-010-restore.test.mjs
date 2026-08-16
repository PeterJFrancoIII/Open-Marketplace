import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("owner-restored listing tools stay present without a spoofable social editor", async () => {
  const restored = [
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
  for (const relative of restored) {
    assert.equal(existsSync(new URL(relative, root)), true, relative);
  }

  const marketplace = await readFile(new URL("app/marketplace.tsx", root), "utf8");
  assert.match(marketplace, /Pay the seller/);
  assert.match(marketplace, /Get estimates/);
  assert.match(marketplace, /editingListingId/);
  assert.match(marketplace, /photoDraftsFromExisting/);
  assert.match(marketplace, /Edit listing/);
  assert.match(marketplace, /socialProofs: \[\]/);
  assert.doesNotMatch(marketplace, /Social trust profile/);
  assert.doesNotMatch(marketplace, /social-editor/);

  const listingsRoute = await readFile(
    new URL("app/api/listings/route.ts", root),
    "utf8",
  );
  assert.match(listingsRoute, /export async function PATCH/);
  assert.match(listingsRoute, /storedSocialProofs/);
  assert.match(listingsRoute, /facebookConnectedUserIds/);
  assert.match(listingsRoute, /mergeConnectedFacebookProof/);
  assert.doesNotMatch(listingsRoute, /incomingSocialProofs/);

  const authSource = await readFile(new URL("lib/auth.ts", root), "utf8");
  assert.doesNotMatch(authSource, /fillEmptyProfileFromFacebook/);
  assert.match(authSource, /updateUserInfoOnLink:\s*false/);
});
