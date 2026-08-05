import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrustCardFromListing,
  hasProviderConnected,
} from "../lib/trust/trust-card-model.ts";

test("TrustCard model never invents a universal trust score", () => {
  const model = buildTrustCardFromListing({
    profileId: "seller-1",
    displayName: "Mina",
    memberSince: "2024-01-15T00:00:00.000Z",
    itemsSold: 12,
    sellerRating: 4.8,
    sellerRatingCount: 10,
    buyerRating: 5,
    buyerRatingCount: 4,
    socialProofs: [
      {
        provider: "instagram",
        url: "https://instagram.com/mina",
        handle: "mina",
        health: "active",
        metricsSource: "oauth",
        connectionCount: 1200,
        connectionLabel: "followers",
        lastCheckedAt: "2026-08-05T12:00:00.000Z",
      },
    ],
  });

  assert.equal("trustScore" in model, false);
  assert.equal(model.experienceLabel, "Active");
  assert.match(model.seller.label, /4\.8 from 10 reviews/);
  assert.match(model.seller.label, /12 completed sales/);
  assert.equal(hasProviderConnected(model), true);
  assert.ok(model.disclosures.some((d) => /not one trust score/i.test(d)));
  assert.ok(model.social[0]?.statusLabel.includes("provider"));
});

test("low sample sizes hide precise means", () => {
  const model = buildTrustCardFromListing({
    profileId: "new-1",
    displayName: "New",
    itemsSold: 1,
    sellerRating: 5,
    sellerRatingCount: 2,
    buyerRatingCount: 0,
    socialProofs: [],
  });
  assert.equal(model.seller.displayMean, null);
  assert.match(model.seller.label, /New — 2 reviews/);
  assert.equal(model.experienceLabel, "New");
});

test("dead social links mark action required", () => {
  const model = buildTrustCardFromListing({
    profileId: "s2",
    displayName: "Pat",
    itemsSold: 5,
    socialProofs: [
      {
        provider: "facebook",
        url: "https://facebook.com/dead",
        health: "dead",
      },
    ],
  });
  assert.equal(model.actionRequired, true);
  assert.equal(model.standing, "social_action_required");
});
