import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  connectedFacebookSocialProof,
  expandSocialProfileInput,
  mergeConnectedFacebookProof,
  publicFacebookProfileUrl,
} from "../lib/facebook-listing-proof.ts";
import { checkSocialAccount } from "../lib/social-health.ts";

test("connected Facebook replaces typed Facebook and drops pasted profiles", () => {
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

  assert.equal(merged.length, 1);
  assert.equal(merged[0].provider, "facebook");
  assert.equal(merged[0].metricsSource, "oauth");
  assert.equal(merged[0].displayName, "Peter Franco");
  assert.equal(merged[0].handle, undefined);
  assert.equal(merged[0].url, "");
  assert.equal(merged[0].connectionCount, undefined);
  assert.equal(merged[0].accountCreatedAt, undefined);
  assert.doesNotMatch(JSON.stringify(merged), /typed\.seller|instagram\.com/);

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

test("social connect completes a username into the official profile URL", () => {
  assert.equal(
    expandSocialProfileInput("facebook", "openmarketplace.seller"),
    "https://www.facebook.com/openmarketplace.seller",
  );
  assert.equal(
    expandSocialProfileInput("instagram", "openmarketplace.test"),
    "https://www.instagram.com/openmarketplace.test",
  );
  assert.equal(
    expandSocialProfileInput("tiktok", "@openmarketplace"),
    "https://www.tiktok.com/@openmarketplace",
  );
  assert.equal(
    expandSocialProfileInput("facebook", "facebook.com/openmarketplace.seller"),
    "https://facebook.com/openmarketplace.seller",
  );
  assert.equal(
    publicFacebookProfileUrl("https://www.facebook.com/profile.php?id=61500000000000"),
    "https://www.facebook.com/profile.php?id=61500000000000",
  );
  assert.equal(publicFacebookProfileUrl("https://facebook.com"), "");
  assert.equal(
    publicFacebookProfileUrl(
      "https://www.facebook.com/app_scoped_user_id/example-app-scoped-id/",
    ),
    "",
  );
  assert.equal(expandSocialProfileInput("facebook", ""), "");
});

test("listings without a Facebook Login row hide typed social", () => {
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
  assert.deepEqual(typed, []);

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
    displayName: "Peter Franco",
    location: "New York, NY",
    hometown: "Philadelphia, PA",
    bio: "Seller bio from Facebook",
    locale: "en_US",
    gender: "male",
    ageRange: "21-21",
    metricsSource: "oauth",
    accountCreatedAt: "2012-06-15",
    connectionCount: 5400,
  });
  assert.equal(checked.metricsSource, "oauth");
  assert.equal(checked.health, "active");
  assert.equal(checked.url, "https://www.facebook.com/openmarketplace.seller");
  assert.equal(checked.connectionCount, undefined);
  assert.equal(checked.accountCreatedAt, undefined);
  assert.equal(checked.location, "New York, NY");
  assert.equal(checked.hometown, "Philadelphia, PA");
  assert.equal(checked.bio, "Seller bio from Facebook");
  assert.equal(checked.locale, "en_US");
  assert.equal(checked.gender, "male");
  assert.equal(checked.ageRange, "21-21");
  assert.match(checked.healthMessage ?? "", /Connected with Facebook Login/);
});

test("listing cards show Connected Facebook instead of a typed URL", async () => {
  const marketplace = await readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8");
  assert.match(marketplace, /Connected with Facebook Login/);
  assert.match(marketplace, /officialConnectorDisplay/);
  assert.match(marketplace, /officialConnectorLine/);
  assert.match(marketplace, /SocialAccountFact/);
  assert.match(marketplace, /Not connected:/);
  assert.match(marketplace, /isConnectedFacebookProof/);
  assert.match(marketplace, /ConnectorAnchor/);
  assert.match(marketplace, /socialProfileHref/);
  assert.match(marketplace, /closest\("a, button"\)/);
  assert.match(marketplace, /paymentLinkFor/);
  assert.match(marketplace, /socialProofs: \[\]/);
  assert.match(marketplace, /demoSocial/);
  assert.doesNotMatch(marketplace, /Social trust profile/);
});
