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
const USER_EMAIL = "shipping-owner@example.com";
const USER_PASSWORD = "a-long-test-password";
const PARCEL_USER = "test-parcel-monkey-user";
const PARCEL_TOKEN = "test-parcel-monkey-token-not-real";

const emptyAssets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

const executionCtx = {
  waitUntil() {},
  passThroughOnException() {},
};

const SAMPLE_PACKAGE = {
  weightLb: 2,
  lengthIn: 12,
  widthIn: 9,
  heightIn: 6,
  originPostal: "11215",
  destPostal: "10001",
  originCountry: "US",
  destCountry: "US",
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

function createTestEnv(d1, extras = {}) {
  return {
    ASSETS: emptyAssets,
    DB: d1,
    BETTER_AUTH_SECRET: TEST_SECRET,
    MARKETPLACE_ADMIN_EMAILS: "admin@example.com",
    ...extras,
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

function assertNoSecrets(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert.doesNotMatch(text, new RegExp(PARCEL_TOKEN));
  assert.doesNotMatch(text, /accessToken|clientSecret|apiToken/i);
}

function installParcelMonkeyStub() {
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
    if (url === "https://api.parcelmonkey.co.uk/GetQuote") {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("userid"), PARCEL_USER);
      assert.equal(headers.get("token"), PARCEL_TOKEN);
      assert.equal(headers.get("apiversion"), "3.1");
      const body = JSON.parse(String(init?.body ?? "{}"));
      assert.equal(body.origin, "US");
      assert.equal(body.destination, "US");
      assert.ok(Array.isArray(body.boxes));
      assert.equal(body.boxes[0].length, 30);
      return new Response(
        JSON.stringify([
          {
            carrier: "Royal Mail",
            service_name: "Tracked 24",
            service_description: "Estimate only",
            total_price_gross: "12.40",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (/parcelmonkey|pirateship/i.test(url)) {
      throw new Error(`Unexpected shipping host: ${url}`);
    }
    return originalFetch.call(globalThis, input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("shipping helpers stay on official Parcel Monkey and Pirate Ship hosts", async () => {
  const [parcelSource, packageSource, marketplace, workflow] = await Promise.all([
    readFile(new URL("../lib/parcel-monkey.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/shipping-package.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-cloudflare-pages.yml", import.meta.url), "utf8"),
  ]);

  assert.match(parcelSource, /https:\/\/api\.parcelmonkey\.co\.uk\/GetQuote/);
  assert.doesNotMatch(parcelSource, /CreateShipment|BookShipment|label/i);
  assert.match(packageSource, /https:\/\/www\.pirateship\.com\/ship/);
  assert.match(packageSource, /https:\/\/www\.parcelmonkey\.com\/shipping-calculator/);
  assert.doesNotMatch(packageSource, /pirateship-api|taciturnaxolotl|api\.pirateship/i);
  assert.match(marketplace, /Get estimates/);
  assert.match(marketplace, /Pirate Ship calculator/);
  assert.match(marketplace, /not a booking/);
  assert.match(workflow, /PAGES_PREVIEW_PARCEL_MONKEY_USER_ID/);
  assert.match(workflow, /PAGES_PREVIEW_PARCEL_MONKEY_API_TOKEN/);
});

test("Parcel Monkey credentials stay off the production Pages config", () => {
  const configured = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: "8ddff0ae-f810-4d71-955e-4aab40a00e27",
    authSecret: TEST_SECRET,
    adminEmails: "preview-admin@example.com",
    facebookClientId: "",
    facebookClientSecret: "",
    parcelMonkeyUserId: PARCEL_USER,
    parcelMonkeyApiToken: PARCEL_TOKEN,
  });
  assert.equal(configured.preview.env_vars.PARCEL_MONKEY_USER_ID.value, PARCEL_USER);
  assert.equal(configured.preview.env_vars.PARCEL_MONKEY_API_TOKEN.type, "secret_text");
  assert.deepEqual(Object.keys(configured.production.env_vars), ["RELEASE_MODE"]);
  assert.equal(configured.production.env_vars.PARCEL_MONKEY_USER_ID, undefined);
  assert.equal(configured.production.env_vars.PARCEL_MONKEY_API_TOKEN, undefined);
  assert.equal(
    configured.production.d1_databases.DB.id,
    "6ceb8dfc-4a92-4d4d-832f-ff1a54847326",
  );

  const missing = buildPagesPreviewDeploymentConfigs({
    previewD1DatabaseId: "8ddff0ae-f810-4d71-955e-4aab40a00e27",
    authSecret: TEST_SECRET,
    adminEmails: "preview-admin@example.com",
    parcelMonkeyUserId: PARCEL_USER,
    parcelMonkeyApiToken: "",
  });
  assert.equal(missing.preview.env_vars.PARCEL_MONKEY_USER_ID, undefined);
  assert.equal(missing.preview.env_vars.PARCEL_MONKEY_API_TOKEN, undefined);
});

test("signed-in quotes without Parcel Monkey credentials return calculator links only", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("shipping-quotes-unconfigured");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Ship Owner",
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });

  const response = await postJson(worker, env, "/api/shipping/quotes", cookieJar, {
    package: SAMPLE_PACKAGE,
    goodsValueUsd: 40,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.available, false);
  assert.deepEqual(body.quotes, []);
  assert.equal(body.pirateShipUrl, "https://www.pirateship.com/ship");
  assert.equal(
    body.parcelMonkeyCalculatorUrl,
    "https://www.parcelmonkey.com/shipping-calculator",
  );
  assert.match(body.message, /not configured/i);
  assertNoSecrets(body);
});

test("configured Parcel Monkey quotes stay GetQuote-only and never book", async () => {
  const restoreFetch = installParcelMonkeyStub();
  try {
    const d1 = createMemoryD1();
    applyMarketplaceMigrations(d1);
    const worker = await loadWorker("shipping-quotes-configured");
    const env = createTestEnv(d1, {
      PARCEL_MONKEY_USER_ID: PARCEL_USER,
      PARCEL_MONKEY_API_TOKEN: PARCEL_TOKEN,
    });
    const cookieJar = new Map();

    await signUp(worker, env, {
      name: "Quote Owner",
      email: "quote-owner@example.com",
      password: USER_PASSWORD,
    });
    await signIn(worker, env, cookieJar, {
      email: "quote-owner@example.com",
      password: USER_PASSWORD,
    });

    const response = await postJson(worker, env, "/api/shipping/quotes", cookieJar, {
      package: SAMPLE_PACKAGE,
      goodsValueUsd: 40,
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.available, true);
    assert.equal(body.quotes[0].carrier, "Royal Mail");
    assert.equal(body.quotes[0].totalPrice, "12.40");
    assert.equal(body.quotes[0].currency, "GBP");
    assert.equal(body.pirateShipUrl, "https://www.pirateship.com/ship");
    assertNoSecrets(body);
  } finally {
    restoreFetch();
  }
});

test("published listings expose pay-to rails and hide the package trailer", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("shipping-listing-package");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Package Seller",
    email: "package-seller@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: "package-seller@example.com",
    password: USER_PASSWORD,
  });

  const saved = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [
      { rail: "paypal", destination: "seller@example.com" },
      {
        rail: "bitcoin_mainnet",
        destination: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      },
    ],
  });
  assert.equal(saved.status, 200);

  const published = await postJson(worker, env, "/api/listings", cookieJar, {
    title: "Shipped lamp",
    description: "Works. Pickup or ship.",
    priceCents: 4000,
    condition: "Good",
    category: "Furniture",
    locationLabel: "Brooklyn, NY",
    format: "Fixed price",
    delivery: "Both",
    shippingPackage: SAMPLE_PACKAGE,
    socialProofs: [],
    imageManifest: [],
  });
  assert.equal(published.status, 201);
  const publishedBody = await published.json();
  assert.equal(publishedBody.listing.description, "Works. Pickup or ship.");
  assert.doesNotMatch(publishedBody.listing.description, /OM_PACKAGE/);
  assert.deepEqual(publishedBody.listing.shippingPackage, SAMPLE_PACKAGE);
  assert.equal(publishedBody.listing.paymentDestinations[0].rail, "paypal");
  assertNoSecrets(publishedBody);

  const stored = d1.__sqlite
    .prepare("select description, status from listings where id = ?")
    .get(publishedBody.listing.id);
  assert.equal(stored.status, "active");
  assert.match(stored.description, /^Works\. Pickup or ship\.\n\nOM_PACKAGE:/);
  assert.deepEqual(
    JSON.parse(stored.description.slice(stored.description.indexOf("OM_PACKAGE:") + 11)),
    SAMPLE_PACKAGE,
  );
});

test("shipping broker connectors stay on official hosts and persist without a new column", async () => {
  const [settings, brokers] = await Promise.all([
    readFile(new URL("../app/account/account-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/shipping-brokers.ts", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /Shipping connectors/);
  assert.match(settings, /Connect \{broker\.label\}/);
  assert.match(brokers, /https:\/\/www\.pirateship\.com\/ship/);
  assert.match(brokers, /https:\/\/www\.parcelmonkey\.com\/shipping-calculator/);
  assert.match(brokers, /https:\/\/www\.usps\.com\/ship\//);
  assert.doesNotMatch(brokers, /pirateship-api|CreateShipment|easypost|shippo/i);

  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("shipping-broker-profile");
  const env = createTestEnv(d1);
  const cookieJar = new Map();

  await signUp(worker, env, {
    name: "Broker Owner",
    email: "broker-owner@example.com",
    password: USER_PASSWORD,
  });
  await signIn(worker, env, cookieJar, {
    email: "broker-owner@example.com",
    password: USER_PASSWORD,
  });

  const savedPayments = await putJson(worker, env, "/api/account/profile", cookieJar, {
    paymentDestinations: [{ rail: "paypal", destination: "seller@example.com" }],
  });
  assert.equal(savedPayments.status, 200);

  const savedBrokers = await putJson(worker, env, "/api/account/profile", cookieJar, {
    shippingBrokers: [
      { id: "pirate_ship", account: null },
      { id: "parcel_monkey", account: "shipper@example.com" },
    ],
  });
  assert.equal(savedBrokers.status, 200);
  const savedBody = await savedBrokers.json();
  assert.equal(savedBody.paymentDestinations[0].rail, "paypal");
  assert.deepEqual(
    savedBody.shippingBrokers.map((item) => item.id),
    ["pirate_ship", "parcel_monkey"],
  );
  assert.equal(savedBody.shippingBrokers[1].account, "shipper@example.com");
  assertNoSecrets(savedBody);

  const stored = d1.__sqlite
    .prepare("select payment_destinations_json from profiles where id is not null")
    .get();
  const bundle = JSON.parse(stored.payment_destinations_json);
  assert.equal(bundle.v, 2);
  assert.equal(bundle.destinations[0].rail, "paypal");

  const rejected = await putJson(worker, env, "/api/account/profile", cookieJar, {
    shippingBrokers: [{ id: "parcel_monkey", account: PARCEL_TOKEN }],
  });
  assert.equal(rejected.status, 400);
});
