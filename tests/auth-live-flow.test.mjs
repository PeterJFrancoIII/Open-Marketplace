import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";

// Built Worker resolves `cloudflare:workers` in workerd; Node tests need a shim
// so `worker.fetch(..., env)` bindings reach getDb()/getMarketplaceAuth().
register(new URL("./helpers/cloudflare-workers-loader.mjs", import.meta.url));
await new Promise((resolve) => setImmediate(resolve));

const TEST_SECRET = "test-secret-with-at-least-32-characters!!";
const ADMIN_EMAIL = "admin@example.com";
const USER_EMAIL = "user@example.com";
const USER_PASSWORD = "a-long-test-password";

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

function createTestEnv(d1, adminEmails = ADMIN_EMAIL) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: adminEmails,
  };
}

async function workerFetch(worker, env, path, init = {}) {
  globalThis.__OPEN_MARKETPLACE_TEST_ENV__ = env;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("host")) {
    headers.set("host", "localhost");
  }
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
    if (/^https:\/\/(?:www\.)?(?:facebook|instagram|tiktok)\.com\//i.test(url)) {
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

function insertListing(
  d1,
  { id, sellerId, sellerName, status, priceCents, createdAt, title = id },
) {
  d1.__sqlite
    .prepare(
      `INSERT INTO listings (
        id, title, description, price_cents, condition, category,
        location_label, seller_id, seller_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      title,
      "Account portal test listing",
      priceCents,
      "Good",
      "Furniture",
      "Brooklyn, NY",
      sellerId,
      sellerName,
      status,
      createdAt,
      createdAt,
    );
}

test("creates an account through the public auth API", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-signup");
  const env = createTestEnv(d1);

  const response = await signUp(worker, env, {
    name: "Normal User",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.email, USER_EMAIL);
  assert.equal(body.user.name, "Normal User");
  assert.ok(body.user.id);
});

test("normalizes display names and rejects blank names on the server", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-display-name-policy");
  const env = createTestEnv(d1);

  const response = await signUp(worker, env, {
    name: "  Trimmed User  ",
    email: "trimmed@example.com",
    password: USER_PASSWORD,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.name, "Trimmed User");

  const invalid = await signUp(worker, env, {
    name: "   ",
    email: "blank-name@example.com",
    password: USER_PASSWORD,
  });
  assert.equal(invalid.status, 400);
});

test("account creation does not grant an authenticated portal session", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-autosignin");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  const response = await workerFetch(worker, env, "/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cookieJar,
    body: JSON.stringify({
      name: "Normal User",
      email: USER_EMAIL,
      password: USER_PASSWORD,
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.token, null);
  assert.equal(cookieJar.size, 0);

  const account = await workerFetch(worker, env, "/account", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(account.status, 307);
  assert.match(
    account.headers.get("location") ?? "",
    /^(?:https?:\/\/localhost(?::\d+)?)?\/login\?returnTo=%2Faccount/,
  );
});

test("signed-in users can open /account", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-account");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  assert.equal(
    (
      await signUp(worker, env, {
        name: "Normal User",
        email: USER_EMAIL,
        password: USER_PASSWORD,
      })
    ).status,
    200,
  );
  assert.equal(
    (await signIn(worker, env, cookieJar, {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    })).status,
    200,
  );
  assert.ok(cookieJar.size > 0);

  const account = await workerFetch(worker, env, "/account", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(account.status, 200);
  const html = await account.text();
  assert.match(html, /Welcome,/i);
  assert.match(html, /Normal User/i);
  assert.match(html, />Overview</i);
  assert.match(html, />My listings</i);
  assert.match(html, />Account settings</i);
  assert.match(html, /Back to marketplace/i);
  assert.match(html, /Social media/i);
  assert.match(html, /Facebook/i);
  assert.match(html, /Instagram/i);
  assert.match(html, /TikTok/i);
  assert.match(html, /Payment options/i);
  assert.match(html, /PayPal/i);
  assert.match(html, /Venmo/i);
  assert.match(html, /Cash App/i);
  assert.match(html, /Bitcoin/i);
  assert.match(html, /Ethereum/i);
  assert.match(html, /Tether \(USDT\)/i);
  assert.match(html, /BNB/i);
  assert.match(html, /Solana/i);
  assert.doesNotMatch(html, /Zelle|Apple Pay|Stripe|Plaid/i);
});

test("account totals cover every owned listing and preserve cent prices", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-account-totals");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  const signup = await signUp(worker, env, {
    name: "Listing Owner",
    email: "listing-owner@example.com",
    password: USER_PASSWORD,
  });
  const { user } = await signup.json();
  await signIn(worker, env, cookieJar, {
    email: user.email,
    password: USER_PASSWORD,
  });

  const baseTime = Date.parse("2026-01-01T00:00:00.000Z");
  for (let index = 0; index < 52; index += 1) {
    insertListing(d1, {
      id: `owned-active-${index}`,
      sellerId: user.id,
      sellerName: user.name,
      status: "active",
      priceCents: index === 51 ? 10 : 2500,
      createdAt: new Date(baseTime + index * 1000).toISOString(),
    });
  }
  for (let index = 0; index < 2; index += 1) {
    insertListing(d1, {
      id: `owned-draft-${index}`,
      sellerId: user.id,
      sellerName: user.name,
      status: "draft",
      priceCents: 1500,
      createdAt: new Date(baseTime + (60 + index) * 1000).toISOString(),
    });
  }
  insertListing(d1, {
    id: "owned-sold",
    sellerId: user.id,
    sellerName: user.name,
    status: "sold",
    priceCents: 4000,
    createdAt: new Date(baseTime + 70 * 1000).toISOString(),
  });
  insertListing(d1, {
    id: "other-seller",
    sellerId: "someone-else",
    sellerName: "Other Seller",
    status: "active",
    priceCents: 9999,
    createdAt: new Date(baseTime + 80 * 1000).toISOString(),
    title: "Other seller item",
  });

  const account = await workerFetch(worker, env, "/account", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(account.status, 200);
  const html = await account.text();
  assert.match(html, /<strong>52<\/strong>\s*<span>Active<\/span>/i);
  assert.match(html, /<strong>2<\/strong>\s*<span>Draft<\/span>/i);
  assert.match(html, /<strong>1<\/strong>\s*<span>Sold<\/span>/i);
  assert.match(html, /\$0\.10/);
  assert.doesNotMatch(html, /Other seller item/i);
});

test("account settings update the name and password and can sign out", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-account-settings");
  const env = createTestEnv(d1);
  const cookieJar = new Map();
  const email = "settings@example.com";
  const nextPassword = "a-different-long-password";

  await signUp(worker, env, {
    name: "Settings User",
    email,
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email,
    password: USER_PASSWORD,
  });

  const updateName = await postJson(
    worker,
    env,
    "/api/auth/update-user",
    cookieJar,
    { name: "Updated User" },
  );
  assert.equal(updateName.status, 200);

  const blankName = await postJson(
    worker,
    env,
    "/api/auth/update-user",
    cookieJar,
    { name: "   " },
  );
  assert.equal(blankName.status, 400);

  const changePassword = await postJson(
    worker,
    env,
    "/api/auth/change-password",
    cookieJar,
    {
      currentPassword: USER_PASSWORD,
      newPassword: nextPassword,
      revokeOtherSessions: true,
    },
  );
  assert.equal(changePassword.status, 200);

  const signOut = await postJson(
    worker,
    env,
    "/api/auth/sign-out",
    cookieJar,
    {},
  );
  assert.equal(signOut.status, 200);
  assert.equal(cookieJar.size, 0);

  const signedOutAccount = await workerFetch(worker, env, "/account", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(signedOutAccount.status, 307);

  const oldPasswordJar = new Map();
  const oldPasswordSignIn = await signIn(worker, env, oldPasswordJar, {
    email,
    password: USER_PASSWORD,
  });
  assert.notEqual(oldPasswordSignIn.status, 200);

  const newPasswordJar = new Map();
  const newPasswordSignIn = await signIn(worker, env, newPasswordJar, {
    email,
    password: nextPassword,
  });
  assert.equal(newPasswordSignIn.status, 200);
  const account = await workerFetch(worker, env, "/account", {
    headers: { accept: "text/html" },
    cookieJar: newPasswordJar,
  });
  assert.equal(account.status, 200);
  assert.match(await account.text(), /Updated User/i);
});

test("a normal signed-in user receives 404 from /admin", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-admin-denied");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Normal User",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const response = await workerFetch(worker, env, "/admin", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(response.status, 404);
});

test("an allowlisted signed-in user can open /admin", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-admin-allowed");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Admin User",
    email: ADMIN_EMAIL,
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: ADMIN_EMAIL,
    password: USER_PASSWORD,
  });

  const response = await workerFetch(worker, env, "/admin", {
    headers: { accept: "text/html" },
    cookieJar,
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Admin overview/i);
  assert.match(html, /Registered accounts/i);
  assert.match(html, /Active listings/i);
  assert.match(html, /Open reports/i);
  assert.match(html, /Admin User/i);
  assert.match(html, />Overview</i);
  assert.match(html, />My listings</i);
  assert.match(html, />Account settings</i);
  assert.match(html, />Admin overview</i);
});

test("listing POST ignores browser-supplied seller identity", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-listing-ownership");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  const signup = await signUp(worker, env, {
    name: "Normal User",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  const signupBody = await signup.json();
  await signIn(worker, env, cookieJar, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const response = await workerFetch(worker, env, "/api/listings", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    cookieJar,
    body: JSON.stringify({
      title: "Owned listing",
      description: "Should use session identity, not browser fields.",
      priceCents: 2500,
      condition: "Good",
      category: "Furniture",
      locationLabel: "Brooklyn, NY",
      format: "Fixed price",
      delivery: "Pickup",
      sellerId: "attacker-id",
      sellerName: "Attacker Name",
      socialProofs: [],
      imageManifest: [],
    }),
  });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.listing.sellerId, signupBody.user.id);
  assert.equal(body.listing.sellerName, "Normal User");
  assert.notEqual(body.listing.sellerId, "attacker-id");
  assert.notEqual(body.listing.sellerName, "Attacker Name");
});

test("unsigned profile settings requests are rejected", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-profile-unsigned");
  const env = createTestEnv(d1);

  const read = await getJson(worker, env, "/api/account/profile");
  assert.equal(read.status, 401);

  const write = await putJson(worker, env, "/api/account/profile", undefined, {
    socialAccounts: [],
  });
  assert.equal(write.status, 401);
});

test("authenticated owners persist and remove social settings without oauth verification", async () => {
  const restoreFetch = installSocialFetchStub();
  try {
    const d1 = createMemoryD1();
    applyMarketplaceMigrations(d1);
    const worker = await loadWorker("live-profile-social");
    const env = createTestEnv(d1);
    const cookieJar = new Map();

    await signUp(worker, env, {
      name: "Social Owner",
      email: "social-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "social-owner@example.com",
      password: USER_PASSWORD,
    });

    const saved = await putJson(worker, env, "/api/account/profile", cookieJar, {
      socialAccounts: [
        {
          provider: "facebook",
          url: "https://facebook.com/openmarketplace.test",
          accountCreatedAt: "2018-06-01",
          connectionCount: 12,
          metricsSource: "oauth",
        },
      ],
    });
    assert.equal(saved.status, 200);
    const savedBody = await saved.json();
    assert.equal(savedBody.socialAccounts.length, 1);
    assert.equal(savedBody.socialAccounts[0].provider, "facebook");
    assert.equal(savedBody.socialAccounts[0].metricsSource, "self-reported");
    assert.notEqual(savedBody.socialAccounts[0].health, "invalid");
    assert.doesNotMatch(
      savedBody.socialAccounts[0].healthMessage ?? "",
      /verified/i,
    );

    cookieJar.clear();
    await signIn(worker, env, cookieJar, {
      email: "social-owner@example.com",
      password: USER_PASSWORD,
    });
    const reloaded = await getJson(worker, env, "/api/account/profile", cookieJar);
    assert.equal(reloaded.status, 200);
    const reloadedBody = await reloaded.json();
    assert.equal(reloadedBody.socialAccounts[0].url.includes("facebook.com"), true);
    assert.equal(reloadedBody.socialAccounts[0].metricsSource, "self-reported");

    const removed = await putJson(worker, env, "/api/account/profile", cookieJar, {
      socialAccounts: [],
    });
    assert.equal(removed.status, 200);
    assert.deepEqual((await removed.json()).socialAccounts, []);
  } finally {
    restoreFetch();
  }
});

test("payment destinations stay on the recovered allowlist and reject unsafe values", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-profile-payment");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Payment Owner",
    email: "payment-owner@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: "payment-owner@example.com",
    password: USER_PASSWORD,
  });

  const empty = await getJson(worker, env, "/api/account/profile", cookieJar);
  assert.equal(empty.status, 200);
  const emptyBody = await empty.json();
  assert.deepEqual(
    emptyBody.allowedPaymentRails.map((rail) => rail.id),
    ["paypal", "venmo", "cashapp", "bitcoin", "ethereum", "usdt", "bnb", "solana"],
  );

  const saved = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [
      { rail: "paypal", destination: "seller@example.com" },
      { rail: "venmo", destination: "@openmarkettest" },
      { rail: "cashapp", destination: "$openmarket" },
      { rail: "bitcoin", destination: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
      { rail: "ethereum", destination: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" },
      { rail: "usdt", destination: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" },
      { rail: "bnb", destination: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" },
      { rail: "solana", destination: "So11111111111111111111111111111111111111112" },
    ],
  });
  assert.equal(saved.status, 200);
  const savedBody = await saved.json();
  assert.equal(savedBody.paymentDestinations.length, 8);

  const guessed = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [{ rail: "zelle", destination: "seller@example.com" }],
  });
  assert.equal(guessed.status, 400);

  const unsafeScheme = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [{ rail: "paypal", destination: "javascript:alert(1)" }],
  });
  assert.equal(unsafeScheme.status, 400);

  const privateKey = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [
      {
        rail: "bitcoin",
        destination: "5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ",
      },
    ],
  });
  assert.equal(privateKey.status, 400);

  const afterRejects = await getJson(worker, env, "/api/account/profile", cookieJar);
  const afterBody = await afterRejects.json();
  assert.equal(afterBody.paymentDestinations.length, 8);
  assert.equal(
    afterBody.paymentDestinations.some((item) => item.rail === "zelle"),
    false,
  );
});

test("one account cannot read or change another account's profile settings", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("live-profile-isolation");
  const env = createTestEnv(d1);
  const ownerJar = new Map();
  const otherJar = new Map();

  await signUp(worker, env, {
    name: "Owner User",
    email: "owner-settings@example.com",
    password: USER_PASSWORD,
  });
  await signUp(worker, env, {
    name: "Other User",
    email: "other-settings@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, ownerJar, {
    email: "owner-settings@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, otherJar, {
    email: "other-settings@example.com",
    password: USER_PASSWORD,
  });

  const saved = await putJson(worker, env, "/api/account/profile", ownerJar, {
    paymentDestinations: [{ rail: "paypal", destination: "owner@example.com" }],
  });
  assert.equal(saved.status, 200);

  const otherRead = await getJson(worker, env, "/api/account/profile", otherJar);
  assert.equal(otherRead.status, 200);
  assert.deepEqual((await otherRead.json()).paymentDestinations, []);

  const otherWrite = await putJson(worker, env, "/api/account/profile", otherJar, {
    paymentDestinations: [{ rail: "venmo", destination: "@intruder" }],
  });
  assert.equal(otherWrite.status, 200);

  const ownerRead = await getJson(worker, env, "/api/account/profile", ownerJar);
  const ownerBody = await ownerRead.json();
  assert.equal(ownerBody.paymentDestinations[0].rail, "paypal");
  assert.equal(ownerBody.paymentDestinations[0].destination, "owner@example.com");
});

test("new listings default to saved profile social without changing seller identity", async () => {
  const restoreFetch = installSocialFetchStub();
  try {
    const d1 = createMemoryD1();
    applyMarketplaceMigrations(d1);
    const worker = await loadWorker("live-listing-social-default");
    const env = createTestEnv(d1);
    const cookieJar = new Map();

    const signup = await signUp(worker, env, {
      name: "Listing Social",
      email: "listing-social@example.com",
      password: USER_PASSWORD,
    });
    const { user } = await signup.json();
    await signIn(worker, env, cookieJar, {
      email: "listing-social@example.com",
      password: USER_PASSWORD,
    });

    const saved = await putJson(worker, env, "/api/account/profile", cookieJar, {
      socialAccounts: [
        {
          provider: "instagram",
          url: "https://instagram.com/openmarketplace.test",
          accountCreatedAt: "2019-04-01",
          connectionCount: 20,
        },
      ],
    });
    assert.equal(saved.status, 200);

    const published = await postJson(worker, env, "/api/listings", cookieJar, {
      title: "Profile default listing",
      description: "Should copy saved social without taking attacker identity.",
      priceCents: 1800,
      condition: "Good",
      category: "Furniture",
      locationLabel: "Brooklyn, NY",
      format: "Fixed price",
      delivery: "Pickup",
      sellerId: "attacker-id",
      sellerName: "Attacker Name",
      socialProofs: [],
      imageManifest: [],
    });
    assert.equal(published.status, 201);
    const publishedBody = await published.json();
    assert.equal(publishedBody.listing.sellerId, user.id);
    assert.equal(publishedBody.listing.sellerName, "Listing Social");
    const publishedSocial = JSON.parse(publishedBody.listing.socialProofsJson ?? "[]");
    assert.equal(publishedSocial[0]?.provider, "instagram");
    assert.equal(publishedSocial[0]?.metricsSource, "self-reported");

    const profile = await getJson(worker, env, "/api/account/profile", cookieJar);
    const profileBody = await profile.json();
    assert.equal(profileBody.socialAccounts[0].provider, "instagram");
  } finally {
    restoreFetch();
  }
});
