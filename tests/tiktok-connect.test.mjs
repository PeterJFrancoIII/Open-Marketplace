import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";
import {
  readOfficialSocialProfile,
  SOCIAL_CONNECTOR_IDS,
  TIKTOK_CONNECT_SCOPES,
} from "../lib/social-connectors.ts";

register(new URL("./helpers/cloudflare-workers-loader.mjs", import.meta.url));
await new Promise((resolve) => setImmediate(resolve));

const TEST_SECRET = "test-secret-with-at-least-32-characters!!";
const USER_EMAIL = "tiktok-owner@example.com";
const USER_PASSWORD = "a-long-test-password";
const TIKTOK_CLIENT_KEY = "test-tiktok-client-key";
const TIKTOK_CLIENT_SECRET = "test-tiktok-client-secret-not-real";
const TIKTOK_ACCESS_TOKEN = "test-tiktok-access-token-not-real";

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

function createTestEnv(d1, { tiktok = true } = {}) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: "admin@example.com",
    ...(tiktok
      ? {
          TIKTOK_CLIENT_KEY,
          TIKTOK_CLIENT_SECRET,
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

async function getJson(worker, env, path, cookieJar) {
  return workerFetch(worker, env, path, {
    headers: { accept: "application/json" },
    cookieJar,
  });
}

function userCount(d1) {
  return Number(
    d1.__sqlite.prepare("select count(*) as n from auth_users").get().n,
  );
}

function assertNoSecrets(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.doesNotMatch(text, new RegExp(TIKTOK_CLIENT_SECRET));
  assert.doesNotMatch(text, new RegExp(TIKTOK_ACCESS_TOKEN));
  assert.doesNotMatch(text, /accessToken|refreshToken|clientSecret/i);
}

function insertTikTokAccount(d1, userId, { token = TIKTOK_ACCESS_TOKEN } = {}) {
  const now = Date.now();
  d1.__sqlite
    .prepare(
      `INSERT INTO auth_accounts (
        id, user_id, account_id, provider_id, access_token, refresh_token,
        access_token_expires_at, refresh_token_expires_at, scope, id_token,
        password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "tiktok-account-row",
      userId,
      "tiktok-open-id-1",
      "tiktok",
      token,
      null,
      now + 60_000,
      null,
      "user.info.basic",
      null,
      null,
      now,
      now,
    );
}

function installTikTokUserInfoStub({
  openId = "tiktok-open-id-1",
  displayName = "TikTok Seller",
  ok = true,
} = {}) {
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
    if (/open\.tiktokapis\.com\/v2\/user\/info/i.test(url)) {
      if (!ok) {
        return new Response(JSON.stringify({ error: { code: "access_token_invalid" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return Response.json({
        data: {
          user: {
            open_id: openId,
            union_id: "tiktok-union-1",
            display_name: displayName,
            username: "tiktokseller",
            avatar_url: "https://p16-sign.tiktokcdn.com/avatar.jpg",
            profile_deep_link: "https://www.tiktok.com/@tiktokseller",
            bio_description: "Sells cameras on Open Marketplace.",
            follower_count: 42,
            following_count: 11,
            likes_count: 90,
            video_count: 7,
            is_verified: true,
          },
        },
        error: { code: "ok" },
      });
    }
    return originalFetch.call(globalThis, input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function tiktokConnection(body) {
  return (body.socialConnections ?? []).find((item) => item.id === "tiktok");
}

test("login page and panel have no TikTok sign-in", async () => {
  const [loginSource, panelSource] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/login-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(loginSource, /Connect TikTok|signIn\.social|tiktok/i);
  assert.doesNotMatch(panelSource, /Connect TikTok|signIn\.social|tiktok/i);
});

test("unsigned TikTok social sign-in is rejected and creates no user", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-signin-blocked");
  const env = createTestEnv(d1);
  const before = userCount(d1);

  const response = await postJson(worker, env, "/api/auth/sign-in/social", undefined, {
    provider: "tiktok",
    callbackURL: "/account",
    disableRedirect: true,
  });
  const body = await response.json();
  assert.ok(response.status >= 400 && response.status < 500);
  assert.equal(body.url, undefined);
  assert.doesNotMatch(JSON.stringify(body), /tiktok\.com\/.*authorize/i);
  assert.equal(userCount(d1), before);
});

test("TikTok official profile reads Login Kit basic, profile, and stats fields", async () => {
  const restore = installTikTokUserInfoStub();
  try {
    const profile = await readOfficialSocialProfile("tiktok", TIKTOK_ACCESS_TOKEN);
    assert.equal(profile?.provider, "tiktok");
    assert.equal(profile?.providerAccountId, "tiktok-open-id-1");
    assert.equal(profile?.name, "TikTok Seller");
    assert.equal(profile?.handle, "tiktokseller");
    assert.equal(profile?.profileUrl, "https://www.tiktok.com/@tiktokseller");
    assert.equal(profile?.imageUrl, "https://p16-sign.tiktokcdn.com/avatar.jpg");
    assert.equal(profile?.bio, "Sells cameras on Open Marketplace.");
    assert.equal(profile?.connectionCount, 42);
    assert.equal(profile?.followingCount, 11);
    assert.equal(profile?.likesCount, 90);
    assert.equal(profile?.contentCount, 7);
    assert.equal(profile?.providerVerified, true);
  } finally {
    restore();
  }
});

test("account settings and privacy describe TikTok Connect only", async () => {
  const [settings, auth, privacy, catalog] = await Promise.all([
    readFile(new URL("../app/account/account-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/social-connectors.ts", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /Connect TikTok/);
  assert.match(settings, /Needs reconnect/);
  assert.match(settings, /TIKTOK_CONNECT_SCOPES/);
  assert.match(settings, /user\.info\.basic, user\.info\.profile, and/);
  assert.match(settings, /user\.info\.stats/);
  assert.match(settings, /first line of defense/);
  assert.match(settings, /does not sign you in/);
  assert.match(settings, /import videos/);
  assert.doesNotMatch(settings, /Save TikTok profile|type a TikTok URL/i);
  assert.match(auth, /providers\.tiktok/);
  assert.match(auth, /clientKey: env\.TIKTOK_CLIENT_KEY/);
  assert.match(auth, /clientSecret: env\.TIKTOK_CLIENT_SECRET/);
  assert.match(auth, /disableSignUp:\s*true/);
  assert.match(auth, /updateUserInfoOnLink:\s*false/);
  assert.match(auth, /Social connector tokens stay on the server/);
  assert.match(privacy, /TikTok Login Kit/);
  assert.match(privacy, /user\.info\.basic/);
  assert.match(privacy, /Deleting TikTok data/);
  assert.match(privacy, /user\.info\.profile/);
  assert.match(privacy, /user\.info\.stats/);
  for (const id of SOCIAL_CONNECTOR_IDS) {
    assert.match(catalog, new RegExp(`id: "${id}"`));
  }
  assert.deepEqual([...TIKTOK_CONNECT_SCOPES], [
    "user.info.basic",
    "user.info.profile",
    "user.info.stats",
  ]);
});

test("TikTok link-social requires a session", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-link-requires-session");
  const env = createTestEnv(d1);
  const response = await postJson(worker, env, "/api/auth/link-social", undefined, {
    provider: "tiktok",
    callbackURL: "/account/settings",
    disableRedirect: true,
  });
  assert.ok(response.status >= 400 && response.status < 500);
  assert.equal(userCount(d1), 0);
});

test("signed-in TikTok link-social requests basic, profile, and stats and keeps state", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-link-scope");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "TikTok Owner",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const settingsPage = await workerFetch(worker, env, "/account/settings", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(settingsPage.status, 200);
  const settingsHtml = await settingsPage.text();
  assert.match(settingsHtml, /Connect TikTok/);
  assert.match(settingsHtml, /user\.info\.basic/);
  assert.match(settingsHtml, /user\.info\.profile/);
  assert.match(settingsHtml, /user\.info\.stats/);
  assert.doesNotMatch(settingsHtml, /Continue with TikTok|Sign in with TikTok/i);
  for (const label of ["Facebook", "Instagram", "TikTok", "X", "LinkedIn", "Reddit", "Discord"]) {
    assert.match(settingsHtml, new RegExp(label));
  }

  const response = await postJson(worker, env, "/api/auth/link-social", cookieJar, {
    provider: "tiktok",
    callbackURL: "/account/settings",
    errorCallbackURL: "/account/settings",
    scopes: ["user.info.basic", "user.info.profile", "user.info.stats"],
    disableRedirect: true,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.url, "string");
  const authorizeUrl = new URL(body.url);
  assert.match(authorizeUrl.hostname, /tiktok\.com$/);
  assert.match(authorizeUrl.pathname, /authorize/);
  assert.equal(
    authorizeUrl.searchParams.get("client_key") ??
      authorizeUrl.searchParams.get("client_id"),
    TIKTOK_CLIENT_KEY,
  );
  assert.match(
    authorizeUrl.searchParams.get("redirect_uri") ?? "",
    /\/api\/auth\/callback\/tiktok$/,
  );
  const state = authorizeUrl.searchParams.get("state") ?? "";
  assert.ok(state.length >= 16);
  const scope =
    authorizeUrl.searchParams.get("scope") ??
    authorizeUrl.searchParams.get("scopes") ??
    "";
  assert.match(scope, /user\.info\.basic/);
  assert.match(scope, /user\.info\.profile/);
  assert.match(scope, /user\.info\.stats/);
  assert.doesNotMatch(scope, /video\.list/);
  assertNoSecrets(body);
});

test("invalid TikTok callback state is rejected and creates no user", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-invalid-state");
  const env = createTestEnv(d1);
  const before = userCount(d1);
  const response = await workerFetch(
    worker,
    env,
    "/api/auth/callback/tiktok?code=not-a-real-code&state=forged-state",
  );
  assert.ok(response.status === 302 || response.status === 400 || response.status >= 400);
  assert.equal(userCount(d1), before);
  assert.equal(
    Number(
      d1.__sqlite
        .prepare("select count(*) as n from auth_accounts where provider_id = 'tiktok'")
        .get().n,
    ),
    0,
  );
});

test("TikTok tokens stay off public profile and get-access-token", async () => {
  const restore = installTikTokUserInfoStub();
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-no-token-leak");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const signup = await signUp(worker, env, {
      name: "Keep This Name",
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });
    insertTikTokAccount(d1, user.id);

    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    assert.equal(profile.status, 200);
    const body = await profile.json();
    const tiktok = tiktokConnection(body);
    assert.equal(tiktok?.available, true);
    assert.equal(tiktok?.connected, true);
    assert.equal(tiktok?.needsReconnect, false);
    assert.equal(tiktok?.name, "TikTok Seller");
    assert.equal(tiktok?.handle, "tiktokseller");
    assert.equal(tiktok?.profileUrl, "https://www.tiktok.com/@tiktokseller");
    assert.equal(tiktok?.imageUrl, "https://p16-sign.tiktokcdn.com/avatar.jpg");
    assert.equal(tiktok?.bio, "Sells cameras on Open Marketplace.");
    assert.equal(tiktok?.connectionCount, 42);
    assert.equal(tiktok?.followingCount, 11);
    assert.equal(tiktok?.likesCount, 90);
    assert.equal(tiktok?.contentCount, 7);
    assert.equal(tiktok?.providerVerified, true);
    assertNoSecrets(body);

    const row = d1.__sqlite
      .prepare("select name, email, image from auth_users where id = ?")
      .get(user.id);
    assert.equal(row.name, "Keep This Name");
    assert.equal(row.email, USER_EMAIL);
    assert.equal(row.image, null);

    const tokenLeak = await postJson(
      worker,
      env,
      "/api/auth/get-access-token",
      cookieJar,
      { providerId: "tiktok" },
    );
    assert.ok(tokenLeak.status >= 400);
    assertNoSecrets(await tokenLeak.json());
  } finally {
    restore();
  }
});

test("invalid TikTok authorization fails closed and stays reconnectable", async () => {
  const restore = installTikTokUserInfoStub({ ok: false });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-fail-closed");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const signup = await signUp(worker, env, {
      name: "Stale Owner",
      email: "stale-tiktok@example.com",
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: "stale-tiktok@example.com",
      password: USER_PASSWORD,
    });
    insertTikTokAccount(d1, user.id);
    d1.__sqlite
      .prepare("update profiles set social_accounts_json = ? where id = ?")
      .run(
        JSON.stringify([
          {
            provider: "tiktok",
            url: "https://www.tiktok.com/@stale",
            handle: "stale-handle",
            metricsSource: "oauth",
          },
        ]),
        user.id,
      );

    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    assert.equal(profile.status, 200);
    const body = await profile.json();
    const tiktok = tiktokConnection(body);
    assert.equal(tiktok?.connected, false);
    assert.equal(tiktok?.needsReconnect, true);
    assert.equal(tiktok?.name, null);
    assert.equal(tiktok?.handle, null);
    assert.doesNotMatch(JSON.stringify(body.socialConnections), /stale-handle/);
    assert.equal(userCount(d1), 1);
    assert.equal(
      Number(
        d1.__sqlite
          .prepare("select count(*) as n from auth_accounts where provider_id = 'tiktok'")
          .get().n,
      ),
      1,
    );
  } finally {
    restore();
  }
});

test("Disconnect removes TikTok without deleting the marketplace user", async () => {
  const restore = installTikTokUserInfoStub();
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-disconnect");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const signup = await signUp(worker, env, {
      name: "Linked Owner",
      email: "linked-tiktok@example.com",
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: "linked-tiktok@example.com",
      password: USER_PASSWORD,
    });
    insertTikTokAccount(d1, user.id);

    const connected = await getJson(worker, env, "/api/account/profile", cookieJar);
    assert.equal(tiktokConnection(await connected.json())?.connected, true);

    const unlinked = await postJson(worker, env, "/api/auth/unlink-account", cookieJar, {
      providerId: "tiktok",
    });
    assert.equal(unlinked.status, 200);

    const disconnected = await getJson(worker, env, "/api/account/profile", cookieJar);
    const tiktok = tiktokConnection(await disconnected.json());
    assert.equal(tiktok?.connected, false);
    assert.equal(tiktok?.needsReconnect, false);
    assert.equal(tiktok?.name, null);

    const session = await getJson(worker, env, "/api/auth/get-session", cookieJar);
    const sessionBody = await session.json();
    assert.equal(sessionBody.user.email, "linked-tiktok@example.com");
    assert.equal(sessionBody.user.id, user.id);
    assert.equal(userCount(d1), 1);
    assert.equal(
      Number(
        d1.__sqlite
          .prepare("select count(*) as n from auth_accounts where provider_id = 'tiktok'")
          .get().n,
      ),
      0,
    );
  } finally {
    restore();
  }
});

test("TikTok Connect publishes official listing proof and can raise Social Credit", async () => {
  const restore = installTikTokUserInfoStub();
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("tiktok-no-listing-proof");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const signup = await signUp(worker, env, {
      name: "Listing Owner",
      email: "listing-tiktok@example.com",
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: "listing-tiktok@example.com",
      password: USER_PASSWORD,
    });
    insertTikTokAccount(d1, user.id);
    await getJson(worker, env, "/api/account/profile", cookieJar);

    const published = await postJson(worker, env, "/api/listings", cookieJar, {
      title: "Connected TikTok lamp",
      description: "Should show the official TikTok listing proof.",
      priceCents: 1800,
      condition: "Good",
      category: "Furniture",
      locationLabel: "Brooklyn, NY",
      format: "Fixed price",
      delivery: "Pickup",
      socialProofs: [
        {
          provider: "tiktok",
          url: "https://www.tiktok.com/@spoofed",
          handle: "spoofed",
        },
      ],
      imageManifest: [],
    });
    assert.equal(published.status, 201);
    const publishedBody = await published.json();
    const publishedSocial = JSON.parse(publishedBody.listing.socialProofsJson ?? "[]");
    const tiktokProof = publishedSocial.find((item) => item.provider === "tiktok");
    assert.equal(tiktokProof?.metricsSource, "oauth");
    assert.equal(tiktokProof?.handle, "tiktokseller");
    assert.equal(tiktokProof?.url, "https://www.tiktok.com/@tiktokseller");
    assert.equal(tiktokProof?.connectionCount, 42);
    assert.doesNotMatch(JSON.stringify(publishedSocial), /spoofed|tiktok-open-id-1/);
    assert.ok((publishedBody.listing.socialCreditScore ?? 0) >= 5);
    assertNoSecrets(publishedBody);
  } finally {
    restore();
  }
});
