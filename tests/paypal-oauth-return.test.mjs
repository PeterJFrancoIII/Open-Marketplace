import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";

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

function createTestEnv(d1) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: "admin@example.com",
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    PAYPAL_ENV: "sandbox",
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

async function getJson(worker, env, path, cookieJar) {
  return workerFetch(worker, env, path, {
    headers: { accept: "application/json" },
    cookieJar,
  });
}

test("PayPal callback can finish from one-time server state when the browser session cookie is absent", async () => {
  const originalFetch = globalThis.fetch;
  let tokenExchangeCount = 0;
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
      tokenExchangeCount += 1;
      const body = new URLSearchParams(String(init?.body ?? ""));
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("code"), "test-paypal-code");
      assert.equal(body.get("redirect_uri"), null);
      return new Response(
        JSON.stringify({
          access_token: PAYPAL_ACCESS_TOKEN,
          refresh_token: "test-paypal-refresh-token-not-real",
          expires_in: 28800,
          scope: "openid",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (/^https:\/\/api-m\.sandbox\.paypal\.com\/v1\/identity\//i.test(url)) {
      return new Response(JSON.stringify({ name: "INVALID_TOKEN" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch.call(globalThis, input, init);
  };

  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("paypal-sessionless-return");
  const env = createTestEnv(d1);
  const signedInJar = new Map();

  try {
    await signUp(worker, env, {
      name: "PayPal Return Owner",
      email: "paypal-return-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, signedInJar, {
      email: "paypal-return-owner@example.com",
      password: USER_PASSWORD,
    });
    assert.ok(signedInJar.size > 0);

    const start = await workerFetch(worker, env, "/api/paypal/connect", {
      cookieJar: signedInJar,
      redirect: "manual",
    });
    assert.equal(start.status, 302);
    const authorizeUrl = new URL(start.headers.get("location") ?? "");
    const state = authorizeUrl.searchParams.get("state") ?? "";
    assert.ok(state);
    assert.equal(
      authorizeUrl.searchParams.get("redirect_uri"),
      "http://localhost/api/paypal/callback",
    );

    const callbackJar = new Map();
    const oauthNonce = signedInJar.get("om_paypal_oauth");
    if (oauthNonce) callbackJar.set("om_paypal_oauth", oauthNonce);

    const callbackPath = `/api/paypal/callback?code=test-paypal-code&state=${encodeURIComponent(state)}`;
    const callback = await workerFetch(worker, env, callbackPath, {
      cookieJar: callbackJar,
      redirect: "manual",
    });
    assert.equal(callback.status, 302);
    assert.match(callback.headers.get("location") ?? "", /paypal=linked/);
    assert.equal(tokenExchangeCount, 1);

    const restoredSessionJar = new Map(
      [...signedInJar.entries()].filter(([name]) => name !== "om_paypal_oauth"),
    );
    const profile = await getJson(
      worker,
      env,
      "/api/account/profile",
      restoredSessionJar,
    );
    assert.equal(profile.status, 200);
    const profileBody = await profile.json();
    assert.equal(profileBody.paypalConnection.available, true);
    assert.equal(profileBody.paypalConnection.connected, true);

    const replay = await workerFetch(worker, env, callbackPath, {
      cookieJar: restoredSessionJar,
      redirect: "manual",
    });
    assert.equal(replay.status, 302);
    assert.match(replay.headers.get("location") ?? "", /error=paypal-state/);
    assert.equal(tokenExchangeCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});