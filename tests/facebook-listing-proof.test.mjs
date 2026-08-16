import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  connectedFacebookSocialProof,
  mergeConnectedFacebookProof,
} from "../lib/facebook-listing-proof.ts";
import { checkSocialAccount } from "../lib/social-health.ts";

test("connected Facebook replaces typed Facebook and keeps other profiles", () => {
  const merged = mergeConnectedFacebookProof(
    [
      {
        provider: "facebook",
        url: "https://facebook.com/typed.seller",
        handle: "typed.seller",
        metricsSource: "self-reported",
        accountCreatedAt: "2018-01-01",
        connectionCount: 99,
      },
      {
        provider: "instagram",
        url: "https://instagram.com/openmarketplace.test",
        handle: "openmarketplace.test",
        metricsSource: "self-reported",
      },
    ],
    true,
    "Peter Franco",
  );

  assert.equal(merged.length, 2);
  assert.equal(merged[0].provider, "facebook");
  assert.equal(merged[0].metricsSource, "oauth");
  assert.equal(merged[0].handle, "Peter Franco");
  assert.equal(merged[0].url, "");
  assert.equal(merged[0].connectionCount, undefined);
  assert.equal(merged[0].accountCreatedAt, undefined);
  assert.equal(merged[1].provider, "instagram");
  assert.equal(merged[1].url, "https://instagram.com/openmarketplace.test");

  const withOfficialLink = mergeConnectedFacebookProof(
    [
      {
        provider: "facebook",
        url: "https://www.facebook.com/openmarketplace.seller",
        handle: "Peter Franco",
        metricsSource: "oauth",
      },
      {
        provider: "facebook",
        url: "https://facebook.com/typed.seller",
        metricsSource: "self-reported",
      },
    ],
    true,
    "Peter Franco",
  );
  assert.equal(withOfficialLink[0].url, "https://www.facebook.com/openmarketplace.seller");
  assert.equal(withOfficialLink[0].metricsSource, "oauth");
  assert.doesNotMatch(withOfficialLink[0].url, /typed\.seller/);
});

test("listings without a Facebook Login row keep typed social only", () => {
  const typed = mergeConnectedFacebookProof(
    [
      {
        provider: "facebook",
        url: "https://facebook.com/typed.seller",
        metricsSource: "self-reported",
      },
    ],
    false,
    "Peter Franco",
  );
  assert.equal(typed.length, 1);
  assert.equal(typed[0].provider, "facebook");
  assert.equal(typed[0].metricsSource, "self-reported");
  assert.equal(typed[0].url, "https://facebook.com/typed.seller");

  assert.deepEqual(mergeConnectedFacebookProof([], false, "Peter Franco"), []);
  assert.deepEqual(mergeConnectedFacebookProof([], true, "Peter Franco"), [
    connectedFacebookSocialProof("Peter Franco"),
  ]);
});

test("social health does not invent Facebook friends or require a profile URL for Connect", async () => {
  const checked = await checkSocialAccount({
    provider: "facebook",
    url: "https://www.facebook.com/openmarketplace.seller",
    handle: "Peter Franco",
    metricsSource: "oauth",
    accountCreatedAt: "2012-06-15",
    connectionCount: 5400,
  });
  assert.equal(checked.metricsSource, "oauth");
  assert.equal(checked.health, "active");
  assert.equal(checked.url, "https://www.facebook.com/openmarketplace.seller");
  assert.equal(checked.connectionCount, undefined);
  assert.equal(checked.accountCreatedAt, undefined);
  assert.match(checked.healthMessage ?? "", /Connected with Facebook Login/);
});

test("listing cards show Connected Facebook instead of a typed URL", async () => {
  const marketplace = await readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8");
  assert.match(marketplace, /Connected with Facebook Login/);
  assert.match(marketplace, /isConnectedFacebookProof/);
  assert.match(marketplace, /ConnectorAnchor/);
  assert.match(marketplace, /Open \$\{providerName\(account.provider\)\} profile/);
  assert.match(marketplace, /socialProofs: \[\]/);
  assert.doesNotMatch(marketplace, /Social trust profile/);
});
