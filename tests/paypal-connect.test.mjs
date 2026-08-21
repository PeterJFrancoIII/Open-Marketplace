import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";
import { buildPagesPreviewDeploymentConfigs } from "../scripts/configure-pages-preview.mjs";
import {
  paypalPayHref,
} from "../lib/paypal-pay-link.ts";
import {
  mergePaymentDestinationsForSave,
  mergePaypalIdentity,
  overlayPaypalDestinations,
  parsePaypalIdToken,
  parsePaypalIdentity,
  parsePaypalUserInfo,
  payerIdFromPaypalIdToken,
  paypalAuthorizeUrl,
  paypalMeFromUserInfo,
  paypalPublicPayTo,
  paypalUserInfoUrls,
  PAYPAL_CONNECT_SCOPES,
  PAYPAL_ME_SETUP_URL,
} from "../lib/paypal-public.ts";

register(new URL("./helpers/cloudflare-workers-loader.mjs", import.meta.url));
await new Promise((resolve) => setImmediate(resolve));

const TEST_SECRET = "test-secret-with-at-least-32-characters!!";
const USER_PASSWORD = "a-long-test-password";
const PAYPAL_CLIENT_ID = "test-paypal-client-id";
const PAYPAL_CLIENT_SECRET = "test-paypal-client-secret-not-real";
const PAYPAL_ACCESS_TOKEN = "test-paypal-access-token-not-real";

const emptyAssets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

const executionCtx = {
  waitUntil() {},
  passThroughOnException() {},
};

function extractCookiePairs(response) {
  const entries =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  const pairs = [];
  for (const entry of entries) {
    const [nameValue, ...attributes] = entry.split(";");
    const separator = nameValue.indexOf("=");
    if (separator <= 0) continue;
    const name = nameValue.slice(0, separator).trim();
    const value = nameValue.slice(separator + 1).trim();
    const maxAge = attributes.find((part) => /max-age=/i.test(part));
    const expired =
      (maxAge && Number(maxAge.split("=")[1]) === 0) ||
      attributes.some((part) => /expires=.*1970/i.test(part));
    pairs.push({ name, value, expired });
  }
  return pairs;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(label, `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

function createTestEnv(d1, { paypal = true } = {}) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: "admin@example.com",
    ...(paypal
      ? {
          PAYPAL_CLIENT_ID,
          PAYPAL_CLIENT_SECRET,
          PAYPAL_ENV: "sandbox",
        }
      : {}),
  };
}

async function workerFetch(worker, env, path, init = {}) {
  globalThis.__OPEN_MARKETPLACE_TEST_ENV__ = env;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("host")) headers.set("host", "localhost");
  if (!headers.has("cf-connecting-ip")) {
    headers.set("cf-connecting-ip", "127.0.0.1");
  }
  if (!headers.has("origin") && (init.method === "POST" || init.method === "PUT")) {
    headers.set("origin", "http://localhost");
  }
  if (init.cookieJar?.size) {
    headers.set("cookie", cookieHeader(init.cookieJar));
  }

  const response = await worker.fetch(
    new Request(`http://localhost${path}`, {
      ...init,
      headers,
      redirect: init.redirect ?? "manual",
    }),
    env,
    executionCtx,
  );

  if (init.cookieJar) {
    for (const { name, value, expired } of extractCookiePairs(response)) {
      if (expired || value === "") init.cookieJar.delete(name);
      else init.cookieJar.set(name, value);
    }
  }

  return response;
}

async function signUp(worker, env, { name, email, password }) {
  return workerFetch(worker, env, "/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });
}

async function signIn(worker, env, cookieJar, { email, password }) {
  return workerFetch(worker, env, "/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cookieJar,
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
}

async function postJson(worker, env, path, cookieJar, body) {
  return workerFetch(worker, env, path, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cookieJar,
    body: JSON.stringify(body),
  });
}

async function putJson(worker, env, path, cookieJar, body) {
  return workerFetch(worker, env, path, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cookieJar,
    body: JSON.stringify(body),
  });
}

async function getJson(worker, env, path, cookieJar) {
  return workerFetch(worker, env, path, {
    headers: { accept: "application/json" },
    cookieJar,
  });
}

function paypalIdToken(claims) {
  const payload = typeof claims === "string" ? { sub: claims } : claims;
  const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function installPaypalFetchStub({ paypalMe, userInfoOk = true, idToken } = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input);
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/oauth2\/token/i.test(url)) {
      return new Response(
        JSON.stringify({
          access_token: PAYPAL_ACCESS_TOKEN,
          refresh_token: "test-paypal-refresh-token-not-real",
          expires_in: 28800,
          scope: "openid",
          token_type: "Bearer",
          ...(idToken ? { id_token: idToken } : {}),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/identity\/openidconnect\/userinfo/i.test(url)) {
      if (!userInfoOk) {
        return new Response(JSON.stringify({ name: "INVALID_TOKEN" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          user_id: "https://www.paypal.com/webapps/auth/identity/user/PAYPALPAYERID1",
          sub: "PAYPALPAYERID1",
          name: "Pay Pal Seller",
          email: "seller-paypal@example.com",
          email_verified: true,
          account_type: "PERSONAL",
          verified_account: true,
          ...(paypalMe
            ? { paypalme: `https://www.paypal.me/${paypalMe}` }
            : {}),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/identity\/oauth2\/userinfo/i.test(url)) {
      if (!userInfoOk) {
        return new Response(JSON.stringify({ name: "INVALID_TOKEN" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          payer_id: "PAYPALPAYERID1",
          name: "Pay Pal Seller",
          emails: [{ value: "seller-paypal@example.com", primary: true, confirmed: true }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (/^https:\/\/(?:www\.)?(?:paypal|instagram|tiktok|venmo|cash\.app)/i.test(url)) {
      return new Response("<html><body>profile</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return originalFetch.call(globalThis, input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function assertNoSecrets(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.doesNotMatch(text, new RegExp(PAYPAL_CLIENT_SECRET));
  assert.doesNotMatch(text, new RegExp(PAYPAL_ACCESS_TOKEN));
  assert.doesNotMatch(text, /accessToken|refreshToken|clientSecret/i);
}

test("PayPal pay links fill amount and default to Goods and Services", () => {
  const goods = paypalPayHref({
    destination: "seller-paypal@example.com",
    amountCents: 4200,
    currency: "USD",
    itemName: "Chat lamp",
    kind: "goods_and_services",
  });
  const goodsUrl = new URL(goods ?? "");
  assert.equal(goodsUrl.hostname, "www.paypal.com");
  assert.equal(goodsUrl.pathname, "/cgi-bin/webscr");
  assert.equal(goodsUrl.searchParams.get("cmd"), "_xclick");
  assert.equal(goodsUrl.searchParams.get("business"), "seller-paypal@example.com");
  assert.equal(goodsUrl.searchParams.get("amount"), "42.00");
  assert.equal(goodsUrl.searchParams.get("currency_code"), "USD");
  assert.equal(goodsUrl.searchParams.get("item_name"), "Chat lamp");

  const friends = paypalPayHref({
    destination: "seller-paypal@example.com",
    amountCents: 5500,
    currency: "USD",
    kind: "friends_and_family",
  });
  const friendsUrl = new URL(friends ?? "");
  assert.equal(friendsUrl.hostname, "www.paypal.com");
  assert.equal(friendsUrl.pathname, "/myaccount/transfer/homepage/pay");
  assert.equal(friendsUrl.searchParams.get("recipient"), "seller-paypal@example.com");
  assert.equal(friendsUrl.searchParams.get("amount"), "55.00");
  assert.doesNotMatch(friends ?? "", /cmd=_xclick/);

  const handle = paypalPayHref({
    destination: "https://www.paypal.me/SellerReed",
    amountCents: 1000,
    kind: "friends_and_family",
  });
  assert.equal(handle, "https://www.paypal.com/paypalme/SellerReed/10.00");
});

test("PayPal authorize URL stays on official Log in with PayPal scopes", () => {
  const url = new URL(
    paypalAuthorizeUrl({
      clientId: PAYPAL_CLIENT_ID,
      redirectUri: "https://example.com/api/paypal/callback",
      state: "state-value",
      live: false,
    }),
  );
  assert.equal(url.hostname, "www.sandbox.paypal.com");
  assert.equal(url.pathname, "/signin/authorize");
  assert.equal(url.searchParams.get("scope"), "openid");
  assert.equal(url.searchParams.get("fullPage"), "true");
  assert.deepEqual([...PAYPAL_CONNECT_SCOPES], ["openid"]);
  assert.doesNotMatch(
    url.searchParams.get("scope") ?? "",
    /email|profile|address|phone|payouts|checkout|paypalattributes/,
  );
  assert.deepEqual(
    [...paypalUserInfoUrls(false)],
    [
      "https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo",
      "https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo?schema=openid",
      "https://api-m.sandbox.paypal.com/v1/identity/oauth2/userinfo",
      "https://api-m.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1",
    ],
  );
});

test("PayPal userinfo parser keeps payer id, email, and paypal.me when present", () => {
  const parsed = parsePaypalUserInfo({
    payer_id: "ABC123",
    name: "Seller",
    address: { country: "US" },
    phone_number: "+15555550100",
    emails: [{ value: "Seller@Example.com", primary: true }],
  });
  assert.equal(parsed?.payerId, "ABC123");
  assert.equal(parsed?.email, "seller@example.com");
  assert.equal(parsed?.name, "Seller");
  assert.equal(parsed?.paypalMe, null);
  assert.equal(paypalMeFromUserInfo({ preferred_username: "Seller" }), null);
  assert.equal(
    paypalMeFromUserInfo({ paypalme: "https://www.paypal.me/SellerReed" }),
    "SellerReed",
  );
  assert.equal(
    paypalPublicPayTo({ email: "seller@example.com", paypalMe: "SellerReed" }),
    "https://www.paypal.me/SellerReed",
  );
  assert.equal(
    paypalPublicPayTo({ email: "seller@example.com", paypalMe: null }),
    "seller@example.com",
  );

  const openid = parsePaypalUserInfo({
    user_id: "https://www.paypal.com/webapps/auth/identity/user/XYZ789",
    sub: "XYZ789",
    email: "Personal@Example.com",
    account_type: "PERSONAL",
    paypalme: "https://paypal.me/PersonalSeller",
  });
  assert.equal(openid?.payerId, "XYZ789");
  assert.equal(openid?.email, "personal@example.com");
  assert.equal(openid?.paypalMe, "PersonalSeller");

  const openidOnly = parsePaypalUserInfo({
    sub: "OPENIDONLY1",
    account_type: "PERSONAL",
  });
  assert.equal(openidOnly?.payerId, "OPENIDONLY1");
  assert.equal(openidOnly?.email, "");
  assert.equal(paypalPublicPayTo({ email: "", paypalMe: null }), null);
  assert.equal(payerIdFromPaypalIdToken(paypalIdToken("IDTOKENPAYER")), "IDTOKENPAYER");
  assert.equal(payerIdFromPaypalIdToken("not-a-token"), null);
  assert.equal(parsePaypalUserInfo({ email: "only-email@example.com" }), null);
  const emailOnly = parsePaypalIdentity({
    email: "only-email@example.com",
    emails: ["also@example.com"],
  });
  assert.equal(emailOnly?.payerId, null);
  assert.equal(emailOnly?.email, "only-email@example.com");
  const merged = mergePaypalIdentity(
    emailOnly,
    parsePaypalIdToken(
      paypalIdToken({
        sub: "IDTOKENPAYER",
        email: "id-token@example.com",
        paypalme: "https://www.paypal.me/TokenSeller",
      }),
    ),
  );
  assert.equal(merged.payerId, "IDTOKENPAYER");
  assert.equal(merged.email, "only-email@example.com");
  assert.equal(merged.paypalMe, "TokenSeller");
  const official = parsePaypalIdentity({
    given_name: "Pay",
    family_name: "Pal",
    picture: "https://www.paypalobjects.com/example.png",
    account_type: "PERSONAL",
    verified_account: true,
    email_verified: true,
    locale: "en_US",
    email: "official@example.com",
    sub: "OFFICIALPAYER",
  });
  assert.equal(official?.name, "Pay Pal");
  assert.equal(official?.givenName, "Pay");
  assert.equal(official?.picture, "https://www.paypalobjects.com/example.png");
  assert.equal(official?.accountType, "PERSONAL");
  assert.equal(official?.verifiedAccount, true);
});

test("typed PayPal stays self-reported until Login is linked", () => {
  const typed = overlayPaypalDestinations(
    [
      {
        rail: "paypal",
        destination: "typed@example.com",
        asset: null,
        networkId: null,
        networkLabel: null,
        source: "self-reported",
      },
    ],
    false,
  );
  assert.equal(typed[0].source, "self-reported");
  const linked = overlayPaypalDestinations(typed, true);
  assert.equal(linked[0].source, "oauth");
  const preserved = mergePaymentDestinationsForSave(
    [{ rail: "paypal", destination: "attacker@example.com", asset: null, networkId: null, networkLabel: null, source: "oauth" }],
    [{ rail: "paypal", destination: "seller-paypal@example.com", asset: null, networkId: null, networkLabel: null, source: "oauth" }],
    true,
  );
  assert.equal(preserved[0].destination, "seller-paypal@example.com");
  assert.equal(preserved[0].source, "oauth");
});

test("Connect PayPal starts official Login and fails closed without app credentials", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-connect-unavailable");
  const env = createTestEnv(d1, { paypal: false });
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "PayPal Owner",
    email: "paypal-unavailable@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: "paypal-unavailable@example.com",
    password: USER_PASSWORD,
  });

  const start = await workerFetch(worker, env, "/api/paypal/connect", {
    cookieJar,
    redirect: "manual",
  });
  assert.equal(start.status, 302);
  const location = start.headers.get("location") ?? "";
  assert.match(location, /error=paypal/);
  assert.doesNotMatch(location, /paypal\.com\/connect/i);
});

test("unsigned PayPal social sign-in is rejected", async () => {
  const worker = await loadWorker("paypal-signin-blocked");
  const response = await workerFetch(worker, createTestEnv(undefined, { paypal: true }), "/api/auth/sign-in/social", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ provider: "paypal" }),
  });
  assert.ok(response.status >= 400);
  const body = await response.json();
  assert.doesNotMatch(JSON.stringify(body), /paypal\.com\/connect/i);
});

test("PayPal connect requires a session and then populates the public pay-to email", async () => {
  const restoreFetch = installPaypalFetchStub();
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-link-flow");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const unsigned = await workerFetch(worker, env, "/api/paypal/connect", {
      redirect: "manual",
    });
    assert.equal(unsigned.status, 302);
    assert.match(unsigned.headers.get("location") ?? "", /\/login/);

    await signUp(worker, env, {
      name: "PayPal Owner",
      email: "paypal-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-owner@example.com",
      password: USER_PASSWORD,
    });

    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    assert.equal(start.status, 302);
    const authorizeUrl = new URL(start.headers.get("location") ?? "");
    assert.equal(authorizeUrl.hostname, "www.sandbox.paypal.com");
    assert.equal(authorizeUrl.searchParams.get("scope"), "openid");
    assert.equal(authorizeUrl.searchParams.get("fullPage"), "true");
    assert.match(authorizeUrl.searchParams.get("redirect_uri") ?? "", /\/api\/paypal\/callback$/);
    const state = authorizeUrl.searchParams.get("state") ?? "";
    assert.ok(state);

    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /\/account/);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    assert.doesNotMatch(callback.headers.get("location") ?? "", /paypalme=setup/);
    assert.match(callback.headers.get("location") ?? "", /#surface-paypal-input/);

    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.available, true);
    assert.equal(profileBody.paypalConnection.connected, true);
    assert.equal(profileBody.paypalConnection.email, "seller-paypal@example.com");
    assert.equal(profileBody.paypalConnection.name, "Pay Pal Seller");
    assert.equal(profileBody.paypalConnection.accountType, "PERSONAL");
    assert.equal(profileBody.paypalConnection.verifiedAccount, true);
    assert.equal(profileBody.paypalConnection.paypalMe, null);
    const owner = d1.__sqlite
      .prepare("SELECT id FROM auth_users WHERE email = ?")
      .get("paypal-owner@example.com");
    const savedProfile = d1.__sqlite
      .prepare("SELECT display_name FROM profiles WHERE id = ?")
      .get(owner.id);
    assert.equal(savedProfile.display_name, "PayPal Owner");
    assert.equal(profileBody.paymentDestinations[0]?.rail, "paypal");
    assert.equal(profileBody.paymentDestinations[0]?.destination, "seller-paypal@example.com");
    assert.equal(profileBody.paymentDestinations[0]?.source, "oauth");
    assertNoSecrets(profileBody);

    const savedMe = await postJson(worker, env, "/api/paypal/destination", cookieJar, {
      destination: "paypal.me/SellerReed",
    });
    assert.equal(savedMe.status, 200);
    const savedMeBody = await savedMe.json();
    assert.equal(savedMeBody.paypalConnection.connected, true);
    assert.equal(savedMeBody.paypalConnection.paypalMe, "SellerReed");
    assert.equal(savedMeBody.paypalConnection.email, "seller-paypal@example.com");
    assert.equal(savedMeBody.paypalConnection.name, "Pay Pal Seller");
    assert.equal(
      savedMeBody.paymentDestinations[0]?.destination,
      "https://www.paypal.me/SellerReed",
    );
    assert.equal(savedMeBody.paymentDestinations[0]?.source, "oauth");

    const spoof = await putJson(worker, env, "/api/account/profile", cookieJar, {
      paymentDestinations: [
        {
          rail: "paypal",
          destination: "attacker@example.com",
          source: "oauth",
        },
      ],
    });
    const spoofBody = await spoof.json();
    assert.equal(spoofBody.paymentDestinations[0]?.destination, "https://www.paypal.me/SellerReed");
    assert.equal(spoofBody.paymentDestinations[0]?.source, "oauth");

    const published = await postJson(worker, env, "/api/listings", cookieJar, {
      title: "PayPal lamp",
      description: "Should show PayPal as linked.",
      priceCents: 1800,
      condition: "Good",
      category: "Furniture",
      locationLabel: "Brooklyn, NY",
      format: "Fixed price",
      delivery: "Pickup",
      socialProofs: [],
      imageManifest: [],
    });
    assert.equal(published.status, 201);
    const publishedBody = await published.json();
    assert.equal(publishedBody.listing.paypalLinked, true);
    assert.equal(publishedBody.listing.paymentDestinations[0]?.source, "oauth");
    assertNoSecrets(publishedBody);

    const listed = await getJson(worker, env, "/api/listings?limit=80");
    const listedBody = await listed.json();
    assert.equal(listedBody.listings?.[0]?.paypalLinked, true);
    assertNoSecrets(listedBody);

    const unlinked = await postJson(worker, env, "/api/paypal/disconnect", cookieJar, {});
    assert.equal(unlinked.status, 200);
    const unlinkedBody = await unlinked.json();
    assert.equal(unlinkedBody.paypalConnection.connected, false);
    assert.equal(
      unlinkedBody.paymentDestinations?.some((item) => item.rail === "paypal"),
      false,
    );

    const afterProfile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const afterProfileBody = await afterProfile.json();
    assert.equal(
      afterProfileBody.paymentDestinations?.some((item) => item.rail === "paypal"),
      false,
    );

    const after = await getJson(worker, env, "/api/listings?limit=80");
    const afterBody = await after.json();
    assert.equal(afterBody.listings?.[0]?.paypalLinked, false);
  } finally {
    restoreFetch();
  }
});

test("paypal.me cannot be saved until Log in with PayPal is connected", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-typed-destination");
  const env = createTestEnv(d1, { paypal: false });
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Typed PayPal Owner",
    email: "typed-paypal@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: "typed-paypal@example.com",
    password: USER_PASSWORD,
  });

  const savedVenmo = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [
      { rail: "venmo", destination: "@sellerreed" },
      { rail: "paypal", destination: "old-paypal@example.com" },
    ],
  });
  assert.equal(savedVenmo.status, 200);

  const unsigned = await postJson(worker, env, "/api/paypal/destination", undefined, {
    destination: "paypal.me/SellerReed",
  });
  assert.equal(unsigned.status, 401);

  const blocked = await postJson(worker, env, "/api/paypal/destination", cookieJar, {
    destination: "paypal.me/SellerReed",
  });
  assert.equal(blocked.status, 403);

  const after = await getJson(worker, env, "/api/account/profile", cookieJar);
  const afterBody = await after.json();
  assert.equal(afterBody.paypalConnection.connected, false);
  assert.equal(
    afterBody.paymentDestinations.find((item) => item.rail === "venmo")?.destination,
    "@sellerreed",
  );
});

test("Log in with PayPal fills paypal.me when userinfo includes it", async () => {
  const restoreFetch = installPaypalFetchStub({ paypalMe: "SellerReed" });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-me-from-userinfo");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    await signUp(worker, env, {
      name: "PayPal Me Owner",
      email: "paypal-me-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-me-owner@example.com",
      password: USER_PASSWORD,
    });
    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    assert.doesNotMatch(callback.headers.get("location") ?? "", /paypalme=setup/);
    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.connected, true);
    assert.equal(profileBody.paypalConnection.paypalMe, "SellerReed");
    assert.equal(
      profileBody.paymentDestinations[0]?.destination,
      "https://www.paypal.me/SellerReed",
    );
  } finally {
    restoreFetch();
  }
});

test("Log in with PayPal fills the pay-to from userinfo email plus id_token", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : String(input);
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/oauth2\/token/i.test(url)) {
      return new Response(
        JSON.stringify({
          access_token: PAYPAL_ACCESS_TOKEN,
          refresh_token: "test-paypal-refresh-token-not-real",
          expires_in: 28800,
          scope: "openid",
          token_type: "Bearer",
          id_token: paypalIdToken({ sub: "IDTOKENPAYER2" }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/identity\/openidconnect\/userinfo/i.test(url)) {
      return new Response(JSON.stringify({ email: "live-openid@example.com" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/identity\/oauth2\/userinfo/i.test(url)) {
      return new Response(JSON.stringify({ emails: ["ignored@example.com"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch.call(globalThis, input, init);
  };
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-userinfo-email-merge");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    await signUp(worker, env, {
      name: "PayPal Merge Owner",
      email: "paypal-merge-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-merge-owner@example.com",
      password: USER_PASSWORD,
    });
    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    assert.match(callback.headers.get("location") ?? "", /#surface-paypal-input/);
    assert.doesNotMatch(callback.headers.get("location") ?? "", /paypalme=setup/);
    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.connected, true);
    assert.equal(profileBody.paypalConnection.email, "live-openid@example.com");
    assert.equal(
      profileBody.paymentDestinations[0]?.destination,
      "live-openid@example.com",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Log in with PayPal still links when PayPal returns a token but no profile", async () => {
  const restoreFetch = installPaypalFetchStub({ userInfoOk: false });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-token-only-link");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    await signUp(worker, env, {
      name: "PayPal Token Only Owner",
      email: "paypal-token-only-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-token-only-owner@example.com",
      password: USER_PASSWORD,
    });
    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.connected, true);
  } finally {
    restoreFetch();
  }
});

test("Log in with PayPal still links when the OAuth cookie is missing", async () => {
  const restoreFetch = installPaypalFetchStub();
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-missing-oauth-cookie");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    await signUp(worker, env, {
      name: "PayPal Cookie Owner",
      email: "paypal-cookie-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-cookie-owner@example.com",
      password: USER_PASSWORD,
    });
    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    cookieJar.delete("om_paypal_oauth");
    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.connected, true);
    assert.equal(profileBody.paypalConnection.email, "seller-paypal@example.com");
  } finally {
    restoreFetch();
  }
});

test("Log in with PayPal still links when userinfo is empty but id_token has sub", async () => {
  const restoreFetch = installPaypalFetchStub({
    userInfoOk: false,
    idToken: paypalIdToken("IDTOKENPAYER1"),
  });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-id-token-link");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    await signUp(worker, env, {
      name: "PayPal Token Owner",
      email: "paypal-token-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-token-owner@example.com",
      password: USER_PASSWORD,
    });
    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    assert.match(callback.headers.get("location") ?? "", /paypalme=setup/);
    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.connected, true);
    assert.equal(profileBody.paypalConnection.email, null);
    assert.equal(profileBody.paypalConnection.paypalMe, null);
  } finally {
    restoreFetch();
  }
});

test("Log in with PayPal fills the pay-to from id_token email when userinfo is empty", async () => {
  const restoreFetch = installPaypalFetchStub({
    userInfoOk: false,
    idToken: paypalIdToken({
      sub: "IDTOKENPAYER3",
      email: "id-token@example.com",
    }),
  });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-id-token-email");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    await signUp(worker, env, {
      name: "PayPal Token Email Owner",
      email: "paypal-token-email-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "paypal-token-email-owner@example.com",
      password: USER_PASSWORD,
    });
    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar,
      redirect: "manual",
    });
    const state = new URL(start.headers.get("location") ?? "").searchParams.get("state") ?? "";
    const callback = await workerFetch(
      worker,
      env,
      `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`,
      { cookieJar, redirect: "manual" },
    );
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    assert.doesNotMatch(callback.headers.get("location") ?? "", /paypalme=setup/);
    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.connected, true);
    assert.equal(profileBody.paypalConnection.email, "id-token@example.com");
    assert.equal(
      profileBody.paymentDestinations[0]?.destination,
      "id-token@example.com",
    );
  } finally {
    restoreFetch();
  }
});

test("account settings and listings source offer Link PayPal without checkout", async () => {
  const [settings, marketplace, connect, paypalPublic, payLink, rails, facts] = await Promise.all([
    readFile(new URL("../app/account/account-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/paypal-connect.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/paypal-public.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/paypal-pay-link.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/payment-destinations.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/official-connector-facts.ts", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /Connect PayPal/);
  assert.match(settings, /Log in with PayPal/);
  assert.match(settings, /personal PayPal/);
  assert.match(settings, /not a business checkout/);
  assert.match(settings, /onSavePaypalMe/);
  assert.match(settings, /PAYPAL_ME_SETUP_URL/);
  assert.match(settings, /window\.open\(PAYPAL_ME_SETUP_URL/);
  assert.match(settings, /params.get\("paypal"\) === "linked"/);
  assert.match(settings, /paypal-token/);
  assert.match(settings, /paypal-session/);
  assert.match(settings, /#surface-paypal-input/);
  assert.match(settings, /\/api\/account\/profile/);
  assert.match(settings, /factsFromPaypalConnection/);
  assert.match(settings, /PayPal email/);
  assert.match(facts, /factsFromPaypalConnection/);
  assert.match(paypalPublic, /serializePaypalStoredProfile/);
  assert.match(settings, /paypalme/);
  assert.match(settings, /Connect \$\{rail\.label\}/);
  assert.match(settings, /data-feedback-surface=\{\`Connect \$\{rail\.label\}\`\}/);
  assert.match(settings, /data-feedback-surface=\{\`\$\{rail.label\} input\`\}/);
  assert.match(settings, /surface-connect-paypal/);
  assert.match(settings, /onConnectPayment/);
  assert.match(settings, /onDisconnectPayPal/);
  assert.match(settings, /if \(railId === "paypal"\) \{/);
  assert.match(settings, /window\.location\.assign\("\/api\/paypal\/connect"\)/);
  assert.match(settings, /paypalConnection\.available/);
  assert.match(settings, /paymentDestinationPayload/);
  assert.match(settings, /not a checkout/);
  assert.match(rails, /paypal\.me filled after Log in with PayPal/);
  assert.equal(PAYPAL_ME_SETUP_URL, "https://www.paypal.com/paypalme");
  assert.match(settings, /does not execute, insure, escrow/);
  assert.doesNotMatch(settings, /Orders API|CreateShipment|\/v2\/checkout\/orders|payouts/i);
  assert.match(marketplace, /PayPal · Linked/);
  assert.match(marketplace, /PayPal · Connected/);
  assert.match(marketplace, /PayPal · Not connected/);
  assert.match(marketplace, /paypalListingState/);
  assert.match(marketplace, /PayPalListingFact/);
  assert.match(marketplace, /listingPayDetails/);
  assert.match(marketplace, /goods_and_services/);
  assert.match(marketplace, /paypalMeHandle/);
  assert.match(payLink, /cmd/);
  assert.match(payLink, /_xclick/);
  assert.match(payLink, /friends_and_family/);
  assert.match(paypalPublic, /openid/);
  assert.match(paypalPublic, /openidconnect\/userinfo/);
  assert.match(paypalPublic, /PAYPAL_CONNECT_SCOPES = \["openid"\]/);
  assert.match(connect, /paypalUserInfoUrls/);
  assert.doesNotMatch(
    `${connect}\n${paypalPublic}\n${payLink}`,
    /\/v2\/checkout\/orders|payouts/,
  );
});

test("preview PayPal credentials stay off the production Pages config", async () => {
  const withPaypal = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: "8ddff0ae-f810-4d71-955e-4aab40a00e27",
    authSecret: TEST_SECRET,
    adminEmails: "preview-admin@example.com",
    paypalClientId: PAYPAL_CLIENT_ID,
    paypalClientSecret: PAYPAL_CLIENT_SECRET,
    paypalEnv: "sandbox",
  });
  assert.equal(withPaypal.preview.env_vars.PAYPAL_CLIENT_ID.value, PAYPAL_CLIENT_ID);
  assert.equal(withPaypal.preview.env_vars.PAYPAL_CLIENT_SECRET.type, "secret_text");
  assert.equal(withPaypal.preview.env_vars.PAYPAL_ENV.value, "sandbox");
  assert.equal(withPaypal.production.env_vars.PAYPAL_CLIENT_ID, undefined);
  assert.equal(withPaypal.production.env_vars.PAYPAL_CLIENT_SECRET, undefined);

  const workflow = await readFile(
    new URL("../.github/workflows/deploy-cloudflare-pages.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /PAGES_PREVIEW_PAYPAL_CLIENT_ID/);
  assert.match(workflow, /PAGES_PREVIEW_PAYPAL_CLIENT_SECRET/);
  assert.doesNotMatch(workflow, /PAYPAL_CLIENT_ID: \$\{\{ secrets\./);
});
