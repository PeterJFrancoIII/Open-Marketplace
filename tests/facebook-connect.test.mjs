import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";
import { buildPagesPreviewDeploymentConfigs } from "../scripts/configure-pages-preview.mjs";

register(new URL("./helpers/cloudflare-workers-loader.mjs", import.meta.url));
await new Promise((resolve) => setImmediate(resolve));

const TEST_SECRET = "test-secret-with-at-least-32-characters!!";
const USER_EMAIL = "facebook-owner@example.com";
const USER_PASSWORD = "a-long-test-password";
const FACEBOOK_CLIENT_ID = "test-facebook-client-id";
const FACEBOOK_CLIENT_SECRET = "test-facebook-client-secret-not-real";
const FACEBOOK_ACCESS_TOKEN = "test-facebook-access-token-not-real";

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

function createTestEnv(d1, { facebook = true } = {}) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: "admin@example.com",
    ...(facebook
      ? {
          FACEBOOK_CLIENT_ID,
          FACEBOOK_CLIENT_SECRET,
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

function installFacebookProfileStub({ id, name, pictureUrl }) {
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
    const parsed = new URL(url);
    if (parsed.hostname === "graph.facebook.com" && parsed.pathname === "/debug_token") {
      return new Response(
        JSON.stringify({
          data: {
            is_valid: true,
            app_id: FACEBOOK_CLIENT_ID,
            user_id: id,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (parsed.hostname === "graph.facebook.com" && parsed.pathname === "/me") {
      const fields = (parsed.searchParams.get("fields") ?? "").split(",");
      assert.equal(fields.includes("email"), false);
      assert.equal(fields.includes("birthday"), false);
      assert.equal(fields.includes("location"), false);
      assert.ok(fields.includes("id"));
      assert.ok(fields.includes("first_name"));
      assert.ok(fields.includes("last_name"));
      assert.ok(fields.includes("middle_name"));
      assert.ok(fields.includes("name"));
      assert.ok(fields.includes("short_name"));
      assert.ok(fields.includes("link"));
      assert.ok(fields.some((field) => field.startsWith("picture")));
      return new Response(
        JSON.stringify({
          id,
          name,
          first_name: name.split(" ")[0] ?? name,
          last_name: name.split(" ").slice(1).join(" ") || null,
          middle_name: null,
          short_name: name.split(" ")[0] ?? name,
          name_format: "{first} {last}",
          link: "https://www.facebook.com/openmarketplace.seller",
          picture: { data: { url: pictureUrl, width: 720, height: 720, is_silhouette: false } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch.call(globalThis, input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

function installSocialFetchStub() {
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
    if (/^https:\/\/graph\.facebook\.com\//i.test(url)) {
      return new Response(JSON.stringify({ error: { message: "test stub" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (
      /^https:\/\/(?:graph\.instagram\.com|open\.tiktokapis\.com|api\.twitter\.com|api\.linkedin\.com|oauth\.reddit\.com|discord\.com\/api)\//i.test(
        url,
      )
    ) {
      return new Response(JSON.stringify({}), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (/^https:\/\/(?:www\.)?(?:facebook|instagram|tiktok|x|twitter|linkedin|reddit|discord)\.com\//i.test(url)) {
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

function userCount(d1) {
  return Number(
    d1.__sqlite.prepare("select count(*) as n from auth_users").get().n,
  );
}

function assertNoSecrets(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.doesNotMatch(text, new RegExp(FACEBOOK_CLIENT_SECRET));
  assert.doesNotMatch(text, new RegExp(FACEBOOK_ACCESS_TOKEN));
  assert.doesNotMatch(text, /accessToken|refreshToken|clientSecret/i);
}

function facebookScopes(authorizeUrl) {
  const scope = new URL(authorizeUrl).searchParams.get("scope") ?? "";
  return scope.split(/[,\s]+/).filter(Boolean);
}

test("login page and panel have no Facebook sign-in", async () => {
  const [loginSource, panelSource] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/login-panel.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(loginSource, /linkSocial|signIn\.social|Connect Facebook/i);
  assert.doesNotMatch(panelSource, /linkSocial|signIn\.social|Connect Facebook/i);
  assert.match(panelSource, /\/privacy\/facebook-data-deletion/);

  const worker = await loadWorker("facebook-login-html");
  const response = await workerFetch(worker, createTestEnv(undefined, { facebook: true }), "/login", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Log in to Open Marketplace/i);
  assert.doesNotMatch(html, /Continue with Facebook|Sign in with Facebook|Connect Facebook/i);
});

test("unsigned Facebook social sign-in is rejected and creates no user", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-signin-blocked");
  const env = createTestEnv(d1);
  const before = userCount(d1);

  const response = await postJson(worker, env, "/api/auth/sign-in/social", undefined, {
    provider: "facebook",
    callbackURL: "/account",
    disableRedirect: true,
  });
  const body = await response.json();
  assert.ok(response.status >= 400 && response.status < 500);
  assert.equal(body.url, undefined);
  assert.doesNotMatch(JSON.stringify(body), /facebook\.com\/.*dialog\/oauth/i);
  assert.equal(userCount(d1), before);
  assertNoSecrets(body);
});

test("Facebook link-social requires a session", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-link-unsigned");
  const env = createTestEnv(d1);

  const response = await postJson(worker, env, "/api/auth/link-social", undefined, {
    provider: "facebook",
    callbackURL: "/account",
    scopes: ["public_profile"],
    disableRedirect: true,
  });
  assert.ok(response.status === 401 || response.status === 403);
  assertNoSecrets(await response.json());
});

test("signed-in Facebook link-social requests public_profile only", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-link-scope");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  const signup = await signUp(worker, env, {
    name: "Facebook Owner",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  const signupBody = await signup.json();
  await signIn(worker, env, cookieJar, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const accountPage = await workerFetch(worker, env, "/account/settings", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(accountPage.status, 200);
  const accountHtml = await accountPage.text();
  assert.match(accountHtml, /Connect Facebook/);
  assert.match(accountHtml, /does not sign you in/);
  assert.doesNotMatch(accountHtml, /Continue with Facebook/i);

  const response = await postJson(worker, env, "/api/auth/link-social", cookieJar, {
    provider: "facebook",
    callbackURL: "/account",
    errorCallbackURL: "/account",
    scopes: ["public_profile", "user_link"],
    disableRedirect: true,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.url, "string");
  const authorizeUrl = new URL(body.url);
  assert.equal(authorizeUrl.hostname, "www.facebook.com");
  assert.match(authorizeUrl.pathname, /\/dialog\/oauth$/);
  assert.equal(authorizeUrl.searchParams.get("client_id"), FACEBOOK_CLIENT_ID);
  assert.match(
    authorizeUrl.searchParams.get("redirect_uri") ?? "",
    /\/api\/auth\/callback\/facebook$/,
  );
  const scopes = facebookScopes(body.url);
  assert.ok(scopes.includes("public_profile"));
  assert.ok(scopes.includes("user_link"));
  assert.equal(
    scopes.every((scope) => scope === "public_profile" || scope === "user_link"),
    true,
  );
  assert.equal(scopes.includes("email"), false);
  assert.equal(scopes.includes("user_friends"), false);
  assertNoSecrets(body);
  assert.equal(userCount(d1), 1);
  assert.equal(signupBody.user.email, USER_EMAIL);
});

test("typed Facebook is rejected and never reads as Connected", async () => {
  const restoreFetch = installSocialFetchStub();
  try {
    const d1 = createMemoryD1();
    applyMarketplaceMigrations(d1);
    const worker = await loadWorker("facebook-typed-audit");
    const env = createTestEnv(d1);
    const cookieJar = new Map();

    await signUp(worker, env, {
      name: "Typed Facebook",
      email: "typed-facebook@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "typed-facebook@example.com",
      password: USER_PASSWORD,
    });

    const saved = await workerFetch(worker, env, "/api/account/profile", {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      cookieJar,
      body: JSON.stringify({
        socialAccounts: [
          {
            provider: "facebook",
            url: "https://facebook.com/openmarketplace.test",
            accountCreatedAt: "2018-06-01",
            connectionCount: 12,
            metricsSource: "oauth",
          },
        ],
      }),
    });
    assert.equal(saved.status, 422);
    const savedBody = await saved.json();
    assert.match(savedBody.error ?? "", /Connect/);
    assert.equal(savedBody.socialAccounts, undefined);
    assertNoSecrets(savedBody);

    const reloaded = await workerFetch(worker, env, "/api/account/profile", {
      headers: { accept: "application/json" },
      cookieJar,
    });
    assert.equal(reloaded.status, 200);
    const reloadedBody = await reloaded.json();
    assert.equal(reloadedBody.socialAccounts.length, 0);
    assert.equal(reloadedBody.facebookConnection.available, true);
    assert.equal(reloadedBody.facebookConnection.connected, false);
    assert.equal(reloadedBody.facebookConnection.name, null);
    assertNoSecrets(reloadedBody);

    const cleared = await workerFetch(worker, env, "/api/account/profile", {
      method: "PUT",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      cookieJar,
      body: JSON.stringify({
        socialAccounts: [],
      }),
    });
    assert.equal(cleared.status, 200);
    const clearedBody = await cleared.json();
    assert.equal(clearedBody.socialAccounts.length, 0);
    assert.equal(clearedBody.facebookConnection.connected, false);
    assertNoSecrets(clearedBody);
  } finally {
    restoreFetch();
  }
});

test("Disconnect removes a linked Facebook account without deleting the marketplace user", async () => {
  const restoreFetch = installSocialFetchStub();
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-disconnect");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {

  const signup = await signUp(worker, env, {
    name: "Linked Owner",
    email: "linked-owner@example.com",
    password: USER_PASSWORD,
  });
  const { user } = await signup.json();
  await signIn(worker, env, cookieJar, {
    email: "linked-owner@example.com",
    password: USER_PASSWORD,
  });

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
      "facebook-account-row",
      user.id,
      "facebook-app-scoped-id",
      "facebook",
      FACEBOOK_ACCESS_TOKEN,
      null,
      now + 60_000,
      null,
      "public_profile",
      null,
      null,
      now,
      now,
    );

  const connected = await getJson(worker, env, "/api/account/profile", cookieJar);
  assert.equal(connected.status, 200);
  const connectedBody = await connected.json();
  assert.equal(connectedBody.facebookConnection.available, true);
  assert.equal(connectedBody.facebookConnection.connected, true);
  assertNoSecrets(connectedBody);

  const tokenLeak = await postJson(
    worker,
    env,
    "/api/auth/get-access-token",
    cookieJar,
    { providerId: "facebook" },
  );
  assert.ok(tokenLeak.status >= 400);
  assertNoSecrets(await tokenLeak.json());

  const unlinked = await postJson(
    worker,
    env,
    "/api/auth/unlink-account",
    cookieJar,
    { providerId: "facebook" },
  );
  assert.equal(unlinked.status, 200);

  const disconnected = await getJson(worker, env, "/api/account/profile", cookieJar);
  const disconnectedBody = await disconnected.json();
  assert.equal(disconnectedBody.facebookConnection.connected, false);
  assert.equal(disconnectedBody.facebookConnection.name, null);
  assertNoSecrets(disconnectedBody);

  const session = await getJson(worker, env, "/api/auth/get-session", cookieJar);
  const sessionBody = await session.json();
  assert.equal(sessionBody.user.email, "linked-owner@example.com");
  assert.equal(sessionBody.user.id, user.id);
  assert.equal(userCount(d1), 1);
  assert.equal(
    Number(
      d1.__sqlite
        .prepare(
          "select count(*) as n from auth_accounts where provider_id = 'facebook'",
        )
        .get().n,
    ),
    0,
  );
  } finally {
    restoreFetch();
  }
});

test("Facebook Graph fields stay public_profile only and never request email", async () => {
  const authSource = await readFile(new URL("../lib/auth.ts", import.meta.url), "utf8");
  assert.match(authSource, /FACEBOOK_GRAPH_FIELDS = \[/);
  assert.match(authSource, /first_name/);
  assert.match(authSource, /last_name/);
  assert.match(authSource, /picture\.type\(large\)/);
  assert.match(authSource, /"link"/);
  assert.match(authSource, /getUserInfo:/);
  assert.doesNotMatch(authSource, /fields:\s*\[[^\]]*email/);
  assert.doesNotMatch(authSource, /user_birthday|user_location|user_hometown|user_mobile_phone/);
  assert.doesNotMatch(authSource, /fillEmptyProfileFromFacebook/);
  assert.match(authSource, /updateUserInfoOnLink:\s*false/);

  const accountPage = await readFile(
    new URL("../app/account/page.tsx", import.meta.url),
    "utf8",
  );
  const settingsPage = await readFile(
    new URL("../app/account/settings/page.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(accountPage, /fillEmptyProfileFromFacebook/);
  assert.doesNotMatch(settingsPage, /fillEmptyProfileFromFacebook/);
});

test("Facebook identity stays connection-scoped and is not copied into the core user", async () => {
  const photoUrl = "https://graph.facebook.com/v24.0/me/picture";
  const restoreFetch = installFacebookProfileStub({
    id: "facebook-app-scoped-id",
    name: "Peter Franco",
    pictureUrl: photoUrl,
  });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-fill-empty-photo");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const signup = await signUp(worker, env, {
      name: "Keep This Name",
      email: "keep-name@example.com",
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: "keep-name@example.com",
      password: USER_PASSWORD,
    });

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
        "facebook-fill-row",
        user.id,
        "facebook-app-scoped-id",
        "facebook",
        FACEBOOK_ACCESS_TOKEN,
        null,
        now + 60_000,
        null,
        "public_profile",
        null,
        null,
        now,
        now,
      );

    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    assert.equal(profile.status, 200);
    const body = await profile.json();
    assert.equal(body.facebookConnection.connected, true);
    assert.equal(body.facebookConnection.name, "Peter Franco");
    assert.equal(body.facebookConnection.firstName, "Peter");
    assert.equal(body.facebookConnection.lastName, "Franco");
    assert.equal(body.facebookConnection.imageUrl, photoUrl);
    assertNoSecrets(body);

    const row = d1.__sqlite
      .prepare("select name, email, image from auth_users where id = ?")
      .get(user.id);
    assert.equal(row.name, "Keep This Name");
    assert.equal(row.email, "keep-name@example.com");
    assert.equal(row.image, null);
  } finally {
    restoreFetch();
  }
});

test("listings show a connected Facebook account without a typed profile URL", async () => {
  const restoreFetch = installFacebookProfileStub({
    id: "facebook-app-scoped-id",
    name: "Listing Owner",
    pictureUrl: "https://graph.facebook.com/v24.0/me/picture",
  });
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-listing-proof");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  try {
    const signup = await signUp(worker, env, {
      name: "Listing Owner",
      email: "listing-facebook@example.com",
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: "listing-facebook@example.com",
      password: USER_PASSWORD,
    });

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
        "facebook-listing-row",
        user.id,
        "facebook-app-scoped-id",
        "facebook",
        FACEBOOK_ACCESS_TOKEN,
        null,
        now + 60_000,
        null,
        "public_profile",
        null,
        null,
        now,
        now,
      );

    const published = await postJson(worker, env, "/api/listings", cookieJar, {
      title: "Connected Facebook lamp",
      description: "Should show the seller Facebook Login connection.",
      priceCents: 1800,
      condition: "Good",
      category: "Furniture",
      locationLabel: "Brooklyn, NY",
      format: "Fixed price",
      delivery: "Pickup",
      socialProofs: [
        {
          provider: "facebook",
          url: "https://facebook.com/spoofed.listing",
          accountCreatedAt: "2020-01-01",
          connectionCount: 99,
        },
      ],
      imageManifest: [],
    });
    assert.equal(published.status, 201);
    const publishedBody = await published.json();
    const publishedSocial = JSON.parse(publishedBody.listing.socialProofsJson ?? "[]");
    assert.equal(publishedSocial.length, 1);
    assert.equal(publishedSocial[0]?.provider, "facebook");
    assert.equal(publishedSocial[0]?.metricsSource, "oauth");
    assert.equal(publishedSocial[0]?.handle, "Listing Owner");
    assert.equal(publishedSocial[0]?.url, "https://www.facebook.com/openmarketplace.seller");
    assert.equal(publishedSocial[0]?.connectionCount, undefined);
    assert.doesNotMatch(JSON.stringify(publishedSocial), /spoofed\.listing|facebook-app-scoped-id/);
    assertNoSecrets(publishedBody);

    const listed = await getJson(worker, env, "/api/listings?limit=80");
    assert.equal(listed.status, 200);
    const listedBody = await listed.json();
    const listedSocial = JSON.parse(listedBody.listings?.[0]?.socialProofsJson ?? "[]");
    assert.equal(listedSocial[0]?.metricsSource, "oauth");
    assert.equal(listedSocial[0]?.handle, "Listing Owner");
    assertNoSecrets(listedBody);

    const unlinked = await postJson(
      worker,
      env,
      "/api/auth/unlink-account",
      cookieJar,
      { providerId: "facebook" },
    );
    assert.equal(unlinked.status, 200);

    const afterDisconnect = await getJson(worker, env, "/api/listings?limit=80");
    const afterBody = await afterDisconnect.json();
    const afterSocial = JSON.parse(afterBody.listings?.[0]?.socialProofsJson ?? "[]");
    assert.equal(afterSocial.length, 0);
  } finally {
    restoreFetch();
  }
});

test("account settings source offers Connect, Connected, and Disconnect only", async () => {
  const source = await readFile(
    new URL("../app/account/account-settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Connect Facebook/);
  assert.match(source, />Connected</);
  assert.match(source, /Disconnect/);
  assert.match(source, /linkSocial/);
  assert.match(source, /unlinkAccount/);
  assert.match(source, /public_profile/);
  assert.match(source, /user_link/);
  assert.match(source, /Open Facebook profile/);
  assert.match(source, /Typed usernames[\s\S]*pasted links are not accepted/);
  assert.match(source, /Connect \$\{connector\.label\}/);
  assert.match(source, /SOCIAL_CONNECTORS/);
  assert.match(source, /is not available on this copy of the site yet/);
  assert.doesNotMatch(source, /Save Facebook profile/);
  assert.doesNotMatch(source, /Connect social media/);
  assert.doesNotMatch(source, /expandSocialProfileInput/);
  assert.doesNotMatch(source, /type a username/i);
  assert.doesNotMatch(source, /government verified/i);
  assert.doesNotMatch(source, /user_friends|Marketplace Platform/i);
  assert.match(source, /does not sign[\s\S]*you in[\s\S]*import listings[\s\S]*Facebook verified/);
});

test("preview Facebook credentials stay off the production Pages config", async () => {
  const withFacebook = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: "8ddff0ae-f810-4d71-955e-4aab40a00e27",
    authSecret: TEST_SECRET,
    adminEmails: "preview-admin@example.com",
    facebookClientId: FACEBOOK_CLIENT_ID,
    facebookClientSecret: FACEBOOK_CLIENT_SECRET,
  });
  assert.equal(
    withFacebook.preview.env_vars.FACEBOOK_CLIENT_ID.value,
    FACEBOOK_CLIENT_ID,
  );
  assert.equal(
    withFacebook.preview.env_vars.FACEBOOK_CLIENT_SECRET.type,
    "secret_text",
  );
  assert.deepEqual(Object.keys(withFacebook.production.env_vars), ["RELEASE_MODE"]);
  assert.equal(withFacebook.production.env_vars.FACEBOOK_CLIENT_ID, undefined);
  assert.equal(withFacebook.production.env_vars.FACEBOOK_CLIENT_SECRET, undefined);
  assert.equal(withFacebook.production.env_vars.PARCEL_MONKEY_USER_ID, undefined);
  assert.equal(withFacebook.production.env_vars.PARCEL_MONKEY_API_TOKEN, undefined);
  assert.equal(
    withFacebook.production.d1_databases.DB.id,
    "6ceb8dfc-4a92-4d4d-832f-ff1a54847326",
  );

  const withoutFacebook = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: "8ddff0ae-f810-4d71-955e-4aab40a00e27",
    authSecret: TEST_SECRET,
    adminEmails: "preview-admin@example.com",
    facebookClientId: "",
    facebookClientSecret: FACEBOOK_CLIENT_SECRET,
  });
  assert.equal(withoutFacebook.preview.env_vars.FACEBOOK_CLIENT_ID, undefined);
  assert.equal(withoutFacebook.preview.env_vars.FACEBOOK_CLIENT_SECRET, undefined);

  const workflow = await readFile(
    new URL("../.github/workflows/deploy-cloudflare-pages.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /PAGES_PREVIEW_FACEBOOK_CLIENT_ID/);
  assert.match(workflow, /PAGES_PREVIEW_FACEBOOK_CLIENT_SECRET/);
  assert.doesNotMatch(workflow, /FACEBOOK_CLIENT_ID: \$\{\{ secrets\./);
});
