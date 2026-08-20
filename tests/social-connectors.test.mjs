import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FACEBOOK_CONNECT_SCOPES } from "../lib/facebook-listing-proof.ts";
import { computeSocialCreditScore } from "../lib/social-credit.ts";
import {
  connectedSocialCreditInput,
  mergeConnectedSocialProofs,
  publicSocialProfileUrl,
  SOCIAL_CONNECTOR_IDS,
  SOCIAL_CONNECTORS,
  INSTAGRAM_CONNECT_SCOPES,
  TIKTOK_CONNECT_SCOPES,
  TIKTOK_PUBLIC_LISTING_PROOF_ENABLED,
  TIKTOK_SOCIAL_CREDIT_ENABLED,
  TIKTOK_USER_INFO_FIELDS,
  socialAvailabilityFromEnv,
} from "../lib/social-connectors.ts";
import { buildPagesPreviewDeploymentConfigs } from "../scripts/configure-pages-preview.mjs";

test("social connector catalog covers official Better Auth networks", () => {
  assert.deepEqual(SOCIAL_CONNECTOR_IDS, [
    "facebook",
    "tiktok",
    "instagram",
    "twitter",
    "linkedin",
    "reddit",
    "discord",
  ]);
  assert.equal(SOCIAL_CONNECTORS.length, 7);
  assert.equal(
    SOCIAL_CONNECTORS.every((connector) => connector.scopes.length > 0),
    true,
  );
});

test("public social URLs stay on the provider host allowlist", () => {
  assert.equal(
    publicSocialProfileUrl("tiktok", "https://www.tiktok.com/@openmarketplace"),
    "https://www.tiktok.com/@openmarketplace",
  );
  assert.equal(
    publicSocialProfileUrl("instagram", "https://www.instagram.com/openmarketplace"),
    "https://www.instagram.com/openmarketplace",
  );
  assert.equal(
    publicSocialProfileUrl("twitter", "https://x.com/openmarketplace"),
    "https://x.com/openmarketplace",
  );
  assert.equal(
    publicSocialProfileUrl("reddit", "https://www.reddit.com/user/openmarketplace"),
    "https://www.reddit.com/user/openmarketplace",
  );
  assert.equal(
    publicSocialProfileUrl("discord", "https://discord.com/users/123456789012345678"),
    "https://discord.com/users/123456789012345678",
  );
  assert.equal(
    publicSocialProfileUrl("instagram", "https://evil.example/instagram.com/spoof"),
    "",
  );
  assert.equal(
    publicSocialProfileUrl("twitter", "http://x.com/openmarketplace"),
    "",
  );
  assert.equal(publicSocialProfileUrl("linkedin", ""), "");
  assert.equal(
    publicSocialProfileUrl("tiktok", "https://evil.example/tiktok.com/@spoof"),
    "",
  );
});

test("Facebook Connect requests official hometown and location scopes", () => {
  const facebook = SOCIAL_CONNECTORS.find((connector) => connector.id === "facebook");
  assert.deepEqual([...FACEBOOK_CONNECT_SCOPES], [
    "public_profile",
    "user_link",
    "user_hometown",
    "user_location",
  ]);
  assert.deepEqual([...(facebook?.scopes ?? [])], [...FACEBOOK_CONNECT_SCOPES]);
  assert.equal(FACEBOOK_CONNECT_SCOPES.includes("email"), false);
  assert.equal(FACEBOOK_CONNECT_SCOPES.includes("user_birthday"), false);
  assert.equal(FACEBOOK_CONNECT_SCOPES.includes("user_mobile_phone"), false);
  assert.equal(FACEBOOK_CONNECT_SCOPES.includes("user_friends"), false);
});

test("TikTok Connect uses Login Kit basic, profile, and stats scopes", () => {
  const tiktok = SOCIAL_CONNECTORS.find((connector) => connector.id === "tiktok");
  assert.deepEqual([...TIKTOK_CONNECT_SCOPES], [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
  ]);
  assert.deepEqual([...(tiktok?.scopes ?? [])], [...TIKTOK_CONNECT_SCOPES]);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("username"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("profile_deep_link"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("bio_description"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("follower_count"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("following_count"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("likes_count"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("video_count"), true);
  assert.equal(TIKTOK_USER_INFO_FIELDS.includes("is_verified"), true);
  assert.equal(TIKTOK_PUBLIC_LISTING_PROOF_ENABLED, true);
  assert.equal(TIKTOK_SOCIAL_CREDIT_ENABLED, true);
});

test("Instagram Connect uses Instagram Login basic scope only", async () => {
  const instagram = SOCIAL_CONNECTORS.find((connector) => connector.id === "instagram");
  assert.deepEqual([...INSTAGRAM_CONNECT_SCOPES], ["instagram_business_basic"]);
  assert.deepEqual([...(instagram?.scopes ?? [])], [...INSTAGRAM_CONNECT_SCOPES]);
  const [auth, settings, privacy] = await Promise.all([
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/account/account-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /www\.instagram\.com\/oauth\/authorize/);
  assert.match(auth, /api\.instagram\.com\/oauth\/access_token/);
  assert.match(auth, /disableSignUp:\s*true/);
  assert.doesNotMatch(auth, /user_profile/);
  assert.doesNotMatch(
    `${auth}\n${settings}\n${privacy}`,
    /instagram_business_manage_messages|instagram_business_content_publish|instagram_business_manage_comments/,
  );
  assert.match(settings, /instagram_business_basic/);
  assert.match(privacy, /instagram_business_basic/);
});

test("TikTok is available only when preview client key and secret are both set", () => {
  assert.equal(
    socialAvailabilityFromEnv({
      TIKTOK_CLIENT_KEY: "tt-key",
      TIKTOK_CLIENT_SECRET: "tt-secret",
    }).tiktok,
    true,
  );
  assert.equal(
    socialAvailabilityFromEnv({
      TIKTOK_CLIENT_KEY: "tt-key",
    }).tiktok,
    false,
  );
  assert.equal(socialAvailabilityFromEnv({}).tiktok, false);
  assert.equal(socialAvailabilityFromEnv({}).facebook, false);
});

test("saved social proofs stay oauth-only and drop typed spoofs", async () => {
  const source = await readFile(
    new URL("../lib/profile-settings.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /metricsSource !== "oauth"/);
  assert.match(source, /isSocialConnectorId/);
  assert.match(source, /SOCIAL_CONNECT_ONLY_ERROR/);
});

test("TikTok official fields populate listing proofs and Social Credit input", () => {
  const merged = mergeConnectedSocialProofs(
    [
      {
        provider: "tiktok",
        url: "https://www.tiktok.com/@seller",
        handle: "seller",
        connectionCount: 12,
        metricsSource: "oauth",
      },
      {
        provider: "facebook",
        url: "https://www.facebook.com/openmarketplace.seller",
        handle: "Peter Franco",
        metricsSource: "oauth",
      },
    ],
    ["tiktok", "facebook"],
    "Peter Franco",
  );
  assert.deepEqual(
    merged.map((account) => account.provider),
    ["facebook", "tiktok"],
  );
  assert.equal(merged[1].url, "https://www.tiktok.com/@seller");
  assert.equal(merged[1].connectionCount, 12);
  const credit = connectedSocialCreditInput(merged);
  assert.deepEqual(
    credit.map((account) => account.provider),
    ["facebook", "tiktok"],
  );
  assert.equal(computeSocialCreditScore({ connectedSocial: credit }), 9);
});

test("listing proofs only include currently connected providers", () => {
  const merged = mergeConnectedSocialProofs(
    [
      {
        provider: "twitter",
        url: "https://x.com/official",
        handle: "official",
        metricsSource: "oauth",
      },
      {
        provider: "instagram",
        url: "https://instagram.com/leftover",
        metricsSource: "oauth",
      },
    ],
    ["twitter", "discord"],
    "Peter Franco",
  );
  assert.deepEqual(
    merged.map((account) => account.provider),
    ["twitter", "discord"],
  );
  assert.equal(merged[0].url, "https://x.com/official");
  assert.equal(merged[1].metricsSource, "oauth");
  assert.equal(merged[1].url, "");
});

test("more official social fields raise Social Credit and never exceed the cap", () => {
  const facebookOnly = connectedSocialCreditInput([
    {
      provider: "facebook",
      url: "https://www.facebook.com/openmarketplace.seller",
      handle: "Peter Franco",
      metricsSource: "oauth",
    },
  ]);
  assert.equal(computeSocialCreditScore({ connectedSocial: facebookOnly }), 4);
  const many = connectedSocialCreditInput(
    SOCIAL_CONNECTOR_IDS.map((provider) => ({
      provider,
      url: "",
      handle: provider,
      accountCreatedAt: "2018-01-01",
      connectionCount: 10,
      metricsSource: "oauth",
    })),
  );
  assert.equal(computeSocialCreditScore({ connectedSocial: many }), 35);
  const richer = connectedSocialCreditInput(
    SOCIAL_CONNECTOR_IDS.map((provider) => ({
      provider,
      url: `https://example.test/${provider}`,
      handle: provider,
      displayName: `${provider} name`,
      accountCreatedAt: "2018-01-01",
      connectionCount: 10,
      followingCount: 4,
      likesCount: 8,
      contentCount: 3,
      hasOfficialImage: true,
      hasBio: true,
      hasLocation: true,
      hasWebsite: true,
      hasBanner: true,
      hasAccountType: true,
      hasProviderBadge: true,
      metricsSource: "oauth",
    })),
  );
  assert.equal(computeSocialCreditScore({ connectedSocial: richer }), 50);
});

test("account settings and auth keep Connect-only anti-spoof wiring", async () => {
  const [settings, auth, listings, catalog] = await Promise.all([
    readFile(new URL("../app/account/account-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/listings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/social-connectors.ts", import.meta.url), "utf8"),
  ]);
  for (const id of SOCIAL_CONNECTOR_IDS) {
    assert.match(catalog, new RegExp(`id: "${id}"`));
  }
  assert.match(settings, /SOCIAL_CONNECTORS/);
  assert.match(settings, /first line of defense/);
  assert.match(settings, /linkSocial/);
  assert.match(settings, /unlinkAccount/);
  assert.match(auth, /genericOAuth/);
  assert.match(auth, /disableSignUp:\s*true/);
  assert.match(auth, /Social networks are account connectors only/);
  assert.match(auth, /Social connector tokens stay on the server/);
  assert.match(listings, /mergeConnectedSocialProofs/);
  assert.match(listings, /connectedSocialCreditInput/);
});

test("preview social credentials stay off the production Pages config", () => {
  const withSocial = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: "8ddff0ae-f810-4d71-955e-4aab40a00e27",
    authSecret: "test-secret-with-at-least-32-characters!!",
    adminEmails: "preview-admin@example.com",
    facebookClientId: "fb-id",
    facebookClientSecret: "fb-secret",
    instagramClientId: "ig-id",
    instagramClientSecret: "ig-secret",
    tiktokClientKey: "tt-key",
    tiktokClientSecret: "tt-secret",
    twitterClientId: "x-id",
    twitterClientSecret: "x-secret",
    linkedinClientId: "li-id",
    linkedinClientSecret: "li-secret",
    redditClientId: "rd-id",
    redditClientSecret: "rd-secret",
    discordClientId: "dc-id",
    discordClientSecret: "dc-secret",
  });
  assert.equal(withSocial.preview.env_vars.INSTAGRAM_CLIENT_ID.value, "ig-id");
  assert.equal(withSocial.preview.env_vars.TIKTOK_CLIENT_KEY.value, "tt-key");
  assert.equal(withSocial.preview.env_vars.DISCORD_CLIENT_SECRET.type, "secret_text");
  assert.deepEqual(Object.keys(withSocial.production.env_vars), ["RELEASE_MODE"]);
  assert.equal(withSocial.production.env_vars.INSTAGRAM_CLIENT_ID, undefined);
  assert.equal(withSocial.production.env_vars.TIKTOK_CLIENT_SECRET, undefined);
  assert.equal(withSocial.production.env_vars.TWITTER_CLIENT_ID, undefined);
});
