import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  checkPaymentDestination,
  isLinkCheckFresh,
  listingLinksNeedCheck,
  LINK_HEALTH_TTL_MS,
} from "../lib/link-health.ts";

test("link checks are fresh for 24 hours and stale after that", () => {
  const now = Date.parse("2026-08-16T16:00:00.000Z");
  assert.equal(isLinkCheckFresh(new Date(now - 60_000).toISOString(), now), true);
  assert.equal(
    isLinkCheckFresh(new Date(now - LINK_HEALTH_TTL_MS - 1).toISOString(), now),
    false,
  );
  assert.equal(isLinkCheckFresh(undefined, now), false);
});

test("a listing with no social or payment links does not need a health check", () => {
  assert.equal(listingLinksNeedCheck({ socialProofs: [], paymentDestinations: [] }), false);
  assert.equal(
    listingLinksNeedCheck({
      socialProofs: [
        {
          provider: "instagram",
          url: "https://instagram.com/openmarketplace.test",
        },
      ],
    }),
    true,
  );
});

test("linked PayPal is not treated as a typed URL during health checks", async () => {
  const checked = await checkPaymentDestination({
    rail: "paypal",
    destination: "seller@example.com",
    asset: null,
    networkId: null,
    networkLabel: null,
    source: "oauth",
    accountCreatedAt: "2012-01-01",
  });
  assert.equal(checked.source, "oauth");
  assert.equal(checked.health, "active");
  assert.equal(checked.destination, "seller@example.com");
  assert.match(checked.healthMessage ?? "", /Linked with PayPal Login/);
});

test("listing UI rechecks links on first open in a 24-hour cycle", async () => {
  const marketplace = await readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8");
  assert.match(marketplace, /om-link-health:/);
  assert.match(marketplace, /\/api\/link-health/);
  assert.match(marketplace, /PayPal · Linked/);
  assert.match(marketplace, /PayPal · Not linked/);
  assert.match(marketplace, /listingLinksNeedCheck/);
});
