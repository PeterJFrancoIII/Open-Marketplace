import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker(label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(label, `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

const emptyAssets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

test("redirects signed-out /account requests to login", async () => {
  const worker = await loadWorker("account-boundary");
  const response = await worker.fetch(
    new Request("http://localhost/account", {
      headers: { accept: "text/html" },
      redirect: "manual",
    }),
    {
      ASSETS: emptyAssets,
      DB: undefined,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 307);
  assert.match(
    response.headers.get("location") ?? "",
    /^\/login\?returnTo=%2Faccount/,
  );
});

test("redirects signed-out /admin requests to login", async () => {
  const worker = await loadWorker("admin-boundary");
  const response = await worker.fetch(
    new Request("http://localhost/admin", {
      headers: { accept: "text/html" },
      redirect: "manual",
    }),
    {
      ASSETS: emptyAssets,
      DB: undefined,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 307);
  assert.match(
    response.headers.get("location") ?? "",
    /^\/login\?returnTo=%2Fadmin/,
  );
});

test("rejects unauthenticated listing publication", async () => {
  const worker = await loadWorker("listing-write-boundary");
  const response = await worker.fetch(
    new Request("http://localhost/api/listings", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Unauthorized listing",
        description: "Should not publish without a session.",
        priceCents: 1000,
        condition: "Good",
        category: "Furniture",
        locationLabel: "Brooklyn, NY",
        format: "Fixed price",
        delivery: "Pickup",
        sellerId: "browser-supplied",
        sellerName: "Browser Name",
        socialProofs: [],
        imageManifest: [],
      }),
    }),
    {
      ASSETS: emptyAssets,
      DB: undefined,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Log in to publish a listing.",
  });
});

test("keeps public listing reads available without a session", async () => {
  const worker = await loadWorker("listing-read-boundary");
  const response = await worker.fetch(
    new Request("http://localhost/api/listings?limit=5", {
      headers: { accept: "application/json" },
    }),
    {
      ASSETS: emptyAssets,
      DB: undefined,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.notEqual(response.status, 401);
  assert.notEqual(response.status, 403);
  assert.notEqual(response.status, 307);
  assert.notEqual(response.status, 308);
  assert.match(response.headers.get("content-type") ?? "", /json/i);
  const payload = await response.json();
  assert.equal(typeof payload, "object");
  assert.ok(payload);
});

test("does not expose authentication configuration errors", async () => {
  const worker = await loadWorker("auth-error-boundary");
  const response = await worker.fetch(
    new Request("http://localhost/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({
        email: "visitor@example.com",
        password: "a-long-test-password",
      }),
    }),
    {
      ASSETS: emptyAssets,
      DB: undefined,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Authentication is temporarily unavailable.",
  });
});
