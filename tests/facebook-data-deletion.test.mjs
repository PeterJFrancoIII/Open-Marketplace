import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";
import {
  createDeletionConfirmation,
  createFacebookSignedRequest,
  parseFacebookSignedRequest,
  verifyDeletionConfirmation,
} from "../lib/facebook-data-deletion.ts";

register(new URL("./helpers/cloudflare-workers-loader.mjs", import.meta.url));
await new Promise((resolve) => setImmediate(resolve));

const TEST_SECRET = "test-secret-with-at-least-32-characters!!";
const FACEBOOK_CLIENT_ID = "test-facebook-client-id";
const FACEBOOK_CLIENT_SECRET = "test-facebook-client-secret-not-real";
const FACEBOOK_USER_ID = "facebook-app-scoped-id";

const emptyAssets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

const executionCtx = {
  waitUntil() {},
  passThroughOnException() {},
};

function createTestEnv(d1) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: "admin@example.com",
    FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET,
  };
}

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(label, `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function workerFetch(worker, env, path, init = {}) {
  globalThis.__OPEN_MARKETPLACE_TEST_ENV__ = env;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("host")) headers.set("host", "localhost");
  const response = await worker.fetch(
    new Request(`http://localhost${path}`, {
      ...init,
      headers,
    }),
    env,
    executionCtx,
  );
  return response;
}

test("Facebook signed requests reject forgeries and accept a valid HMAC", () => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const signed = createFacebookSignedRequest(
    { user_id: FACEBOOK_USER_ID, issued_at: issuedAt },
    FACEBOOK_CLIENT_SECRET,
  );
  const parsed = parseFacebookSignedRequest(signed, FACEBOOK_CLIENT_SECRET);
  assert.equal(parsed?.user_id, FACEBOOK_USER_ID);
  assert.equal(parseFacebookSignedRequest(signed, "wrong-secret"), null);
  assert.equal(parseFacebookSignedRequest("not-a-signed-request", FACEBOOK_CLIENT_SECRET), null);
  assert.equal(parseFacebookSignedRequest(`${signed}tamper`, FACEBOOK_CLIENT_SECRET), null);
  const expired = createFacebookSignedRequest(
    { user_id: FACEBOOK_USER_ID, issued_at: issuedAt - 25 * 60 * 60 },
    FACEBOOK_CLIENT_SECRET,
  );
  assert.equal(parseFacebookSignedRequest(expired, FACEBOOK_CLIENT_SECRET), null);
});

test("deletion confirmation codes verify only the issued value", () => {
  const issued = createDeletionConfirmation(1_700_000_123_456, FACEBOOK_CLIENT_SECRET);
  assert.equal(
    verifyDeletionConfirmation(issued.confirmationCode, FACEBOOK_CLIENT_SECRET)?.issuedAt,
    1_700_000_123_456,
  );
  assert.equal(
    verifyDeletionConfirmation(issued.confirmationCode, "other-secret"),
    null,
  );
  assert.equal(verifyDeletionConfirmation("1700000123456-ffffffffffffffffffff", FACEBOOK_CLIENT_SECRET), null);
});

test("Facebook data deletion callback removes the Facebook link and leaves the user", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const now = Date.now();
  d1.__sqlite
    .prepare(
      `INSERT INTO auth_users (id, name, email, email_verified, image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("user-1", "Keep This Name", "keep@example.com", 0, null, now, now);
  d1.__sqlite
    .prepare(
      `INSERT INTO auth_accounts (
        id, user_id, account_id, provider_id, access_token, refresh_token,
        access_token_expires_at, refresh_token_expires_at, scope, id_token,
        password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "facebook-row",
      "user-1",
      FACEBOOK_USER_ID,
      "facebook",
      "facebook-access-token-not-real",
      null,
      now + 60_000,
      null,
      "public_profile",
      null,
      null,
      now,
      now,
    );

  const worker = await loadWorker("facebook-data-deletion");
  const env = createTestEnv(d1);
  const signed = createFacebookSignedRequest(
    { user_id: FACEBOOK_USER_ID },
    FACEBOOK_CLIENT_SECRET,
  );
  const response = await workerFetch(worker, env, "/api/facebook/data-deletion", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ signed_request: signed }).toString(),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.match(body.confirmation_code, /^\d+-[a-f0-9]{20}$/);
  assert.match(
    body.url,
    /\/privacy\/facebook-data-deletion\/status\?code=/,
  );
  assert.doesNotMatch(JSON.stringify(body), /facebook-access-token-not-real/);

  const remaining = d1.__sqlite
    .prepare(
      "select count(*) as n from auth_accounts where provider_id = 'facebook'",
    )
    .get();
  assert.equal(Number(remaining.n), 0);
  const user = d1.__sqlite
    .prepare("select name, email from auth_users where id = ?")
    .get("user-1");
  assert.equal(user.name, "Keep This Name");
  assert.equal(user.email, "keep@example.com");

  const status = await workerFetch(
    worker,
    env,
    `/api/facebook/data-deletion?code=${encodeURIComponent(body.confirmation_code)}`,
  );
  assert.equal(status.status, 200);
  const statusBody = await status.json();
  assert.equal(statusBody.status, "completed");
});

test("unknown Facebook users still receive a deletion confirmation", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("facebook-data-deletion-unknown");
  const env = createTestEnv(d1);
  const signed = createFacebookSignedRequest(
    { user_id: "missing-facebook-user" },
    FACEBOOK_CLIENT_SECRET,
  );
  const response = await workerFetch(worker, env, "/api/facebook/data-deletion", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ signed_request: signed }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.confirmation_code, "string");
});

test("legal pages and account copy stay free of internal agent language", async () => {
  const files = [
    "../app/privacy/page.tsx",
    "../app/privacy/facebook-data-deletion/page.tsx",
    "../app/terms/page.tsx",
    "../app/account/account-settings.tsx",
    "../app/legal/legal-shell.tsx",
  ];
  for (const relative of files) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.doesNotMatch(source, /OM-DEC-|Better Auth|agent handoff/i, relative);
  }
});
