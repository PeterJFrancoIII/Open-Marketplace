import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";
import { computeSocialCreditScore } from "../lib/social-credit.ts";
import {
  saleEvidenceMissing,
  sanitizeSalePhoto,
} from "../lib/sale-evidence.ts";
import {
  applyMarketplaceMigrations,
  createMemoryD1,
} from "./helpers/memory-d1.mjs";

register(new URL("./helpers/cloudflare-workers-loader.mjs", import.meta.url));
await new Promise((resolve) => setImmediate(resolve));

const TEST_SECRET = "test-secret-with-at-least-32-characters!!";
const PASSWORD = "a-long-test-password";
const SECRET_CHAT = "SECRET_CHAT_BODY_om_ful_004";
const RATING_NOTE = "Arrived as described and communication stayed clear.";

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
  };
}

async function workerFetch(worker, env, path, init = {}) {
  globalThis.__OPEN_MARKETPLACE_TEST_ENV__ = env;
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("host")) headers.set("host", "localhost");
  if (!headers.has("cf-connecting-ip")) headers.set("cf-connecting-ip", "127.0.0.1");
  if (!headers.has("origin") && (init.method === "POST" || init.method === "PUT")) {
    headers.set("origin", "http://localhost");
  }
  if (init.cookieJar?.size) headers.set("cookie", cookieHeader(init.cookieJar));

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

async function signUp(worker, env, { name, email, password = PASSWORD }) {
  return workerFetch(worker, env, "/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  });
}

async function signIn(worker, env, cookieJar, { email, password = PASSWORD }) {
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

function salePhoto(name) {
  return {
    hash: `sha256:${"ab".repeat(32)}`,
    name,
    size: 2048,
    type: "image/jpeg",
    bytes: "SECRET_SALE_PHOTO_BYTES",
    dataUrl: "data:image/jpeg;base64,aaaa",
  };
}

function listingWrite(title) {
  return {
    title,
    description: "A live listing used to test chat, sold confirmation, and ratings.",
    priceCents: 4200,
    condition: "Good",
    category: "Furniture",
    locationLabel: "Brooklyn, NY",
    format: "Fixed price",
    delivery: "Pickup",
    socialProofs: [],
    imageManifest: [],
  };
}

function profileRow(d1, userId) {
  return d1.__sqlite
    .prepare(
      `SELECT items_sold, social_credit_score, seller_rating, seller_rating_count,
              buyer_rating, buyer_rating_count
       FROM profiles WHERE id = ?`,
    )
    .get(userId);
}

test("Social Credit stays 0 without ratings and matches the published formula", () => {
  assert.equal(computeSocialCreditScore({}), 0);
  assert.equal(computeSocialCreditScore({ itemsSold: 10 }), 0);
  assert.equal(
    computeSocialCreditScore({
      sellerRating: 5,
      sellerRatingCount: 1,
      itemsSold: 1,
    }),
    82,
  );
  assert.equal(
    computeSocialCreditScore({
      sellerRating: 5,
      sellerRatingCount: 1,
      buyerRating: 5,
      buyerRatingCount: 1,
      itemsSold: 10,
    }),
    100,
  );
  assert.equal(
    computeSocialCreditScore({
      buyerRating: 4,
      buyerRatingCount: 1,
      itemsSold: 0,
    }),
    64,
  );
});

test("chat and sold-archive source contracts stay private and session-gated", async () => {
  const marketplace = await readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8");
  assert.match(marketplace, /contactSeller/);
  assert.match(marketplace, /\/api\/conversations/);
  assert.match(marketplace, /Sold archive/);
  assert.doesNotMatch(
    marketplace,
    /Contact transport is the next protocol adapter to connect/,
  );

  const listingsRoute = await readFile(
    new URL("../app/api/listings/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(listingsRoute, /compactSoldListing/);
  assert.match(listingsRoute, /archive: true/);
  assert.match(listingsRoute, /socialCreditScore/);
  assert.doesNotMatch(listingsRoute, /conversationMessages/);
  assert.doesNotMatch(listingsRoute, /conversation_messages/);
  assert.doesNotMatch(listingsRoute, /payment_receipt/);
  assert.doesNotMatch(listingsRoute, /received_item/);
  assert.doesNotMatch(listingsRoute, /shipped_item/);
  assert.doesNotMatch(listingsRoute, /evidence_request/);
  assert.doesNotMatch(listingsRoute, /tracking_number/);

  const replica = await readFile(new URL("../lib/replica-host.ts", import.meta.url), "utf8");
  assert.doesNotMatch(replica, /conversation_messages/);
  assert.doesNotMatch(replica, /lastMessagePreview/);
  assert.doesNotMatch(replica, /payment_receipt/);
  assert.doesNotMatch(replica, /received_item/);
  assert.doesNotMatch(replica, /shippedItem/);
  assert.doesNotMatch(replica, /evidenceRequest/);
  assert.doesNotMatch(replica, /trackingNumber/);

  const messagesUi = await readFile(
    new URL("../app/account/messages/messages-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(messagesUi, /Pending/);
  assert.match(messagesUi, /In-Transfer/);
  assert.match(messagesUi, /Complete cannot be/);
  assert.match(messagesUi, /Goods and Services/);
  assert.match(messagesUi, /Friends and Family/);
  assert.match(messagesUi, /\/api\/conversations\/paypal/);
  assert.match(messagesUi, /Tracking number/);
  assert.match(messagesUi, /Tracking updates/);
  assert.match(messagesUi, /Payment receipt/);
  assert.match(messagesUi, /Photo of the packaging/);
  assert.match(messagesUi, /Photo of the shipping box/);
  assert.match(messagesUi, /Shipping evidence/);
  assert.match(messagesUi, /Accept Evidence/);
  assert.match(messagesUi, /Ask for additional evidence/);
  assert.match(messagesUi, /\/api\/conversations\/evidence/);
  assert.match(messagesUi, /17TRACK/);
  assert.doesNotMatch(messagesUi, /PICKUP/);
});

test("sale proof sanitizers keep hashes and reject missing In-Transfer or Complete files", () => {
  const receipt = sanitizeSalePhoto(salePhoto("receipt.jpg"), "paymentReceipt");
  assert.equal(receipt?.name, "receipt.jpg");
  assert.equal(receipt?.hash.startsWith("sha256:"), true);
  assert.equal("bytes" in (receipt ?? {}), false);
  const pdfReceipt = sanitizeSalePhoto(
    { ...salePhoto("receipt.pdf"), type: "application/pdf" },
    "paymentReceipt",
  );
  assert.equal(pdfReceipt?.name, "receipt.pdf");
  assert.equal(
    sanitizeSalePhoto(
      { ...salePhoto("box.pdf"), type: "application/pdf" },
      "receivedItem",
    ),
    null,
  );
  assert.equal(
    sanitizeSalePhoto(salePhoto("shipped-item.jpg"), "shippedItem")?.name,
    "shipped-item.jpg",
  );
  assert.equal(
    saleEvidenceMissing("seller", "in_transfer", {}),
    "Enter the actual UPS, USPS, FedEx, or DHL tracking number for this item.",
  );
  assert.equal(
    saleEvidenceMissing("seller", "in_transfer", {
      trackingNumber: "1Z999AA10123456784",
    }),
    "Upload a photo of the item and the shipping box before marking In-Transfer.",
  );
  assert.equal(
    saleEvidenceMissing("buyer", "in_transfer", {}),
    "Only the seller marks In-Transfer. Accept the shipping evidence instead.",
  );
  assert.equal(
    saleEvidenceMissing("buyer", "complete", { paymentReceipt: receipt }),
    "Upload a photo of the product and its packaging before marking Complete.",
  );
});

test("signed-out chat, sale, and rating requests are rejected", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("chat-signed-out");
  const env = createTestEnv(d1);

  const start = await postJson(worker, env, "/api/conversations", undefined, {
    listingId: "missing",
  });
  assert.equal(start.status, 401);

  const inbox = await getJson(worker, env, "/api/conversations");
  assert.equal(inbox.status, 401);

  const message = await postJson(worker, env, "/api/conversations/messages", undefined, {
    conversationId: "missing",
    body: "hello",
  });
  assert.equal(message.status, 401);

  const sale = await postJson(worker, env, "/api/conversations/sale", undefined, {
    conversationId: "missing",
    status: "complete",
  });
  assert.equal(sale.status, 401);

  const rating = await postJson(worker, env, "/api/conversations/rating", undefined, {
    conversationId: "missing",
    score: 5,
    note: RATING_NOTE,
  });
  assert.equal(rating.status, 401);

  const history = await getJson(worker, env, "/api/conversations/history");
  assert.equal(history.status, 401);

  const paypal = await postJson(worker, env, "/api/conversations/paypal", undefined, {
    conversationId: "missing",
    salePriceCents: 100,
  });
  assert.equal(paypal.status, 401);

  const evidence = await postJson(worker, env, "/api/conversations/evidence", undefined, {
    conversationId: "missing",
    trackingNumber: "1Z999AA10123456784",
  });
  assert.equal(evidence.status, 401);

  const accept = await postJson(worker, env, "/api/conversations/evidence", undefined, {
    conversationId: "missing",
    action: "accept",
  });
  assert.equal(accept.status, 401);

  const requestMore = await postJson(worker, env, "/api/conversations/evidence", undefined, {
    conversationId: "missing",
    action: "request",
    note: "Please add a clearer photo of the shipping box.",
  });
  assert.equal(requestMore.status, 401);

  const messagesPage = await workerFetch(worker, env, "/account/messages", {
    headers: { accept: "text/html" },
    redirect: "manual",
  });
  assert.equal(messagesPage.status, 307);
  assert.match(messagesPage.headers.get("location") ?? "", /\/login\?returnTo=%2Faccount%2Fmessages/);
});

test("chat, dual confirm, ratings, and Social Credit follow the owner sale flow", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("chat-sale-credit-flow");
  const env = createTestEnv(d1);
  const sellerJar = new Map();
  const buyerJar = new Map();
  const otherBuyerJar = new Map();

  const sellerSignup = await signUp(worker, env, {
    name: "Seller Reed",
    email: "seller-chat@example.com",
  });
  const sellerId = (await sellerSignup.json()).user.id;
  await signIn(worker, env, sellerJar, { email: "seller-chat@example.com" });

  const buyerSignup = await signUp(worker, env, {
    name: "Buyer Lane",
    email: "buyer-chat@example.com",
  });
  const buyerId = (await buyerSignup.json()).user.id;
  await signIn(worker, env, buyerJar, { email: "buyer-chat@example.com" });

  await signUp(worker, env, {
    name: "Other Buyer",
    email: "other-buyer-chat@example.com",
  });
  await signIn(worker, env, otherBuyerJar, { email: "other-buyer-chat@example.com" });

  const published = await postJson(
    worker,
    env,
    "/api/listings",
    sellerJar,
    listingWrite("Chat lamp"),
  );
  assert.equal(published.status, 201);
  const listing = (await published.json()).listing;

  const ownThread = await postJson(worker, env, "/api/conversations", sellerJar, {
    listingId: listing.id,
  });
  assert.equal(ownThread.status, 400);

  const earlyRating = await postJson(worker, env, "/api/conversations/rating", buyerJar, {
    conversationId: "not-yet",
    score: 5,
    note: RATING_NOTE,
  });
  assert.equal(earlyRating.status, 404);

  const started = await postJson(worker, env, "/api/conversations", buyerJar, {
    listingId: listing.id,
  });
  assert.equal(started.status, 201);
  const conversation = (await started.json()).conversation;
  assert.equal(conversation.buyerId, buyerId);
  assert.equal(conversation.sellerId, sellerId);

  const startedAgain = await postJson(worker, env, "/api/conversations", buyerJar, {
    listingId: listing.id,
  });
  assert.equal(startedAgain.status, 200);
  assert.equal((await startedAgain.json()).conversation.id, conversation.id);

  const sent = await postJson(worker, env, "/api/conversations/messages", buyerJar, {
    conversationId: conversation.id,
    body: SECRET_CHAT,
  });
  assert.equal(sent.status, 201);

  const publicList = await getJson(worker, env, "/api/listings?limit=80");
  const publicListBody = await publicList.json();
  const publicJson = JSON.stringify(publicListBody);
  assert.equal(publicList.status, 200);
  assert.equal(publicListBody.listings?.[0]?.id, listing.id);
  assert.doesNotMatch(publicJson, new RegExp(SECRET_CHAT));
  assert.equal(publicListBody.listings[0].socialCreditScore, 0);

  const beforeConfirm = profileRow(d1, sellerId);
  assert.equal(beforeConfirm.items_sold, 0);
  assert.equal(beforeConfirm.social_credit_score, 0);

  const missingStatus = await postJson(worker, env, "/api/conversations/sale", buyerJar, {
    conversationId: conversation.id,
  });
  assert.equal(missingStatus.status, 400);

  const sellerReceipt = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    sellerJar,
    {
      conversationId: conversation.id,
      paymentReceipt: salePhoto("seller-receipt.jpg"),
    },
  );
  assert.equal(sellerReceipt.status, 403);

  const buyerTracking = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      trackingNumber: "1Z999AA10123456784",
    },
  );
  assert.equal(buyerTracking.status, 403);

  const buyerShipped = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      shippedItem: salePhoto("buyer-shipped.jpg"),
    },
  );
  assert.equal(buyerShipped.status, 403);

  const sellerCompleteEarly = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    sellerJar,
    {
      conversationId: conversation.id,
      status: "complete",
    },
  );
  assert.equal(sellerCompleteEarly.status, 400);

  const sellerNoTracking = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    sellerJar,
    {
      conversationId: conversation.id,
      status: "in_transfer",
    },
  );
  assert.equal(sellerNoTracking.status, 400);

  const sellerPickup = await postJson(worker, env, "/api/conversations/sale", sellerJar, {
    conversationId: conversation.id,
    status: "in_transfer",
    trackingNumber: "PICKUP",
    shippedItem: salePhoto("shipped-item.jpg"),
    shippedPackaging: salePhoto("shipped-box.jpg"),
  });
  assert.equal(sellerPickup.status, 400);

  const sellerTrackingOnly = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    sellerJar,
    {
      conversationId: conversation.id,
      status: "in_transfer",
      trackingNumber: "1Z999AA10123456784",
    },
  );
  assert.equal(sellerTrackingOnly.status, 400);

  const buyerInTransfer = await postJson(worker, env, "/api/conversations/sale", buyerJar, {
    conversationId: conversation.id,
    status: "in_transfer",
    paymentReceipt: salePhoto("receipt.jpg"),
  });
  assert.equal(buyerInTransfer.status, 403);

  const sellerInTransfer = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    sellerJar,
    {
      conversationId: conversation.id,
      status: "in_transfer",
      trackingNumber: "1Z999AA10123456784",
      shippedItem: salePhoto("shipped-item.jpg"),
      shippedPackaging: salePhoto("shipped-box.jpg"),
    },
  );
  assert.equal(sellerInTransfer.status, 200);
  const sellerInTransferBody = await sellerInTransfer.json();
  assert.equal(sellerInTransferBody.conversation.mySaleStatus, "in_transfer");
  assert.equal(sellerInTransferBody.conversation.trackingNumber, "1Z999AA10123456784");
  assert.equal(sellerInTransferBody.conversation.shippedItem.name, "shipped-item.jpg");
  assert.equal(sellerInTransferBody.conversation.shippedPackaging.name, "shipped-box.jpg");
  assert.equal(sellerInTransferBody.conversation.shippedItem.bytes, undefined);
  assert.doesNotMatch(JSON.stringify(sellerInTransferBody), /SECRET_SALE_PHOTO_BYTES/);

  const publicAfterShip = await getJson(worker, env, "/api/listings?limit=80");
  const publicAfterShipJson = JSON.stringify(await publicAfterShip.json());
  assert.doesNotMatch(publicAfterShipJson, /1Z999AA10123456784/);
  assert.doesNotMatch(publicAfterShipJson, /shipped-item\.jpg/);
  assert.doesNotMatch(publicAfterShipJson, /SECRET_SALE_PHOTO_BYTES/);

  const backToPending = await postJson(worker, env, "/api/conversations/sale", sellerJar, {
    conversationId: conversation.id,
    status: "pending",
  });
  assert.equal(backToPending.status, 200);
  const pendingBody = await backToPending.json();
  assert.equal(pendingBody.conversation.mySaleStatus, "pending");
  assert.equal(pendingBody.conversation.trackingNumber, "1Z999AA10123456784");
  assert.equal(pendingBody.conversation.shippedItem.name, "shipped-item.jpg");

  const sellerInTransferAgain = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    sellerJar,
    { conversationId: conversation.id, status: "in_transfer" },
  );
  assert.equal(sellerInTransferAgain.status, 200);
  assert.equal((await sellerInTransferAgain.json()).conversation.mySaleStatus, "in_transfer");

  const buyerAcceptNoReceipt = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      action: "accept",
    },
  );
  assert.equal(buyerAcceptNoReceipt.status, 400);

  const buyerReceipt = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      paymentReceipt: salePhoto("receipt.jpg"),
    },
  );
  assert.equal(buyerReceipt.status, 200);
  const receiptBody = await buyerReceipt.json();
  assert.equal(receiptBody.conversation.paymentReceipt.name, "receipt.jpg");
  assert.equal(receiptBody.conversation.paymentReceipt.bytes, undefined);
  assert.doesNotMatch(JSON.stringify(receiptBody), /SECRET_SALE_PHOTO_BYTES/);

  const publicAfterReceipt = await getJson(worker, env, "/api/listings?limit=80");
  const publicAfterReceiptJson = JSON.stringify(await publicAfterReceipt.json());
  assert.doesNotMatch(publicAfterReceiptJson, /receipt\.jpg/);
  assert.doesNotMatch(publicAfterReceiptJson, /SECRET_SALE_PHOTO_BYTES/);
  assert.doesNotMatch(publicAfterReceiptJson, /sha256:abababababababababababababababababababababababababababababababab/);

  const buyerCompleteBeforeAccept = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    buyerJar,
    {
      conversationId: conversation.id,
      status: "complete",
      receivedItem: salePhoto("item.jpg"),
      receivedPackaging: salePhoto("box.jpg"),
    },
  );
  assert.equal(buyerCompleteBeforeAccept.status, 400);

  const buyerAccept = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      action: "accept",
    },
  );
  assert.equal(buyerAccept.status, 200);
  assert.equal((await buyerAccept.json()).conversation.mySaleStatus, "in_transfer");

  const sellerLocked = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    sellerJar,
    {
      conversationId: conversation.id,
      trackingNumber: "1Z999AA10123456785",
    },
  );
  assert.equal(sellerLocked.status, 409);

  const buyerRequestShort = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      action: "request",
      note: "unclear",
    },
  );
  assert.equal(buyerRequestShort.status, 400);

  const buyerRequest = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      action: "request",
      note: "Please add a clearer photo of the shipping box.",
    },
  );
  assert.equal(buyerRequest.status, 200);
  const requestBody = await buyerRequest.json();
  assert.equal(requestBody.conversation.mySaleStatus, "pending");
  assert.equal(
    requestBody.conversation.evidenceRequestNote,
    "Please add a clearer photo of the shipping box.",
  );

  const sellerUpdate = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    sellerJar,
    {
      conversationId: conversation.id,
      shippedPackaging: salePhoto("shipped-box-2.jpg"),
    },
  );
  assert.equal(sellerUpdate.status, 200);
  const updatedShip = await sellerUpdate.json();
  assert.equal(updatedShip.conversation.shippedPackaging.name, "shipped-box-2.jpg");
  assert.equal(updatedShip.conversation.evidenceRequestNote, null);

  const buyerAcceptAgain = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      action: "accept",
    },
  );
  assert.equal(buyerAcceptAgain.status, 200);
  assert.equal((await buyerAcceptAgain.json()).conversation.mySaleStatus, "in_transfer");

  const buyerNoPhotos = await postJson(worker, env, "/api/conversations/sale", buyerJar, {
    conversationId: conversation.id,
    status: "complete",
  });
  assert.equal(buyerNoPhotos.status, 400);

  const buyerConfirm = await postJson(worker, env, "/api/conversations/sale", buyerJar, {
    conversationId: conversation.id,
    status: "complete",
    receivedItem: salePhoto("item.jpg"),
    receivedPackaging: salePhoto("box.jpg"),
  });
  assert.equal(buyerConfirm.status, 200);
  const afterOneSide = await buyerConfirm.json();
  assert.equal(afterOneSide.conversation.completed, false);
  assert.equal(afterOneSide.conversation.mySaleStatus, "complete");
  assert.equal(afterOneSide.conversation.receivedItem.name, "item.jpg");
  assert.equal(afterOneSide.conversation.receivedPackaging.name, "box.jpg");

  const buyerLockedProof = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    buyerJar,
    {
      conversationId: conversation.id,
      paymentReceipt: salePhoto("changed-receipt.jpg"),
    },
  );
  assert.equal(buyerLockedProof.status, 409);

  const reverseComplete = await postJson(worker, env, "/api/conversations/sale", buyerJar, {
    conversationId: conversation.id,
    status: "pending",
  });
  assert.equal(reverseComplete.status, 409);

  const stillListed = await getJson(worker, env, "/api/listings?limit=80");
  const stillListedBody = await stillListed.json();
  assert.equal(stillListedBody.listings?.[0]?.id, listing.id);
  const afterOneSideProfile = profileRow(d1, sellerId);
  assert.equal(afterOneSideProfile.items_sold, 0);
  assert.equal(afterOneSideProfile.social_credit_score, 0);

  const ratingTooSoon = await postJson(worker, env, "/api/conversations/rating", buyerJar, {
    conversationId: conversation.id,
    score: 5,
    note: RATING_NOTE,
  });
  assert.equal(ratingTooSoon.status, 409);

  const otherStarted = await postJson(worker, env, "/api/conversations", otherBuyerJar, {
    listingId: listing.id,
  });
  assert.equal(otherStarted.status, 201);
  const otherConversation = (await otherStarted.json()).conversation;
  assert.notEqual(otherConversation.id, conversation.id);

  const sellerConfirm = await postJson(worker, env, "/api/conversations/sale", sellerJar, {
    conversationId: conversation.id,
    status: "complete",
  });
  assert.equal(sellerConfirm.status, 200);
  const completed = await sellerConfirm.json();
  assert.equal(completed.conversation.completed, true);
  assert.equal(completed.conversation.listingStatus, "sold");
  assert.equal(completed.conversation.trackingNumber, "1Z999AA10123456784");
  assert.equal(completed.conversation.shippedItem.name, "shipped-item.jpg");

  const lockedEvidence = await postJson(
    worker,
    env,
    "/api/conversations/evidence",
    sellerJar,
    {
      conversationId: conversation.id,
      trackingNumber: "PICKUP",
    },
  );
  assert.equal(lockedEvidence.status, 409);

  const hidden = await getJson(worker, env, "/api/listings?limit=80");
  const hiddenBody = await hidden.json();
  assert.equal(hiddenBody.listings?.length, 0);

  const archive = await getJson(
    worker,
    env,
    `/api/listings?id=${listing.id}&limit=1`,
  );
  const archiveBody = await archive.json();
  const compact = archiveBody.listings?.[0];
  assert.equal(archive.status, 200);
  assert.equal(compact.archive, true);
  assert.equal(compact.status, "sold");
  assert.equal(compact.title, "Chat lamp");
  assert.equal(compact.priceCents, 4200);
  assert.equal(compact.sellerName, "Seller Reed");
  assert.ok(compact.soldAt);
  assert.equal(compact.description, undefined);
  assert.equal(compact.imageManifest, undefined);
  assert.equal(compact.imageManifestJson, undefined);
  assert.equal(compact.paymentDestinations, undefined);
  assert.equal(compact.socialProofsJson, undefined);
  assert.doesNotMatch(JSON.stringify(compact), new RegExp(SECRET_CHAT));
  assert.doesNotMatch(JSON.stringify(compact), /1Z999AA10123456784/);
  assert.doesNotMatch(JSON.stringify(compact), /receipt\.jpg/);
  assert.doesNotMatch(JSON.stringify(compact), /item\.jpg/);
  assert.doesNotMatch(JSON.stringify(compact), /box\.jpg/);
  assert.doesNotMatch(JSON.stringify(compact), /shipped-item\.jpg/);
  assert.doesNotMatch(JSON.stringify(compact), /shipped-box/);

  const afterSale = profileRow(d1, sellerId);
  assert.equal(afterSale.items_sold, 1);
  assert.equal(afterSale.social_credit_score, 0);

  const history = await getJson(worker, env, "/api/conversations/history", buyerJar);
  const historyBody = await history.json();
  assert.equal(history.status, 200);
  assert.equal(historyBody.history?.[0]?.listingId, listing.id);
  assert.equal(historyBody.history[0].myRole, "buyer");
  assert.equal(historyBody.history[0].title, "Chat lamp");

  const buyerRating = await postJson(worker, env, "/api/conversations/rating", buyerJar, {
    conversationId: conversation.id,
    score: 5,
    note: RATING_NOTE,
  });
  assert.equal(buyerRating.status, 200);

  const afterBuyerRating = profileRow(d1, sellerId);
  assert.equal(afterBuyerRating.seller_rating, 5);
  assert.equal(afterBuyerRating.seller_rating_count, 1);
  assert.equal(
    afterBuyerRating.social_credit_score,
    computeSocialCreditScore({
      sellerRating: 5,
      sellerRatingCount: 1,
      itemsSold: 1,
    }),
  );

  const duplicateRating = await postJson(worker, env, "/api/conversations/rating", buyerJar, {
    conversationId: conversation.id,
    score: 4,
    note: RATING_NOTE,
  });
  assert.equal(duplicateRating.status, 409);

  const sellerRating = await postJson(worker, env, "/api/conversations/rating", sellerJar, {
    conversationId: conversation.id,
    score: 4,
    note: RATING_NOTE,
  });
  assert.equal(sellerRating.status, 200);
  const afterSellerRating = profileRow(d1, buyerId);
  assert.equal(afterSellerRating.buyer_rating, 4);
  assert.equal(
    afterSellerRating.social_credit_score,
    computeSocialCreditScore({
      buyerRating: 4,
      buyerRatingCount: 1,
      itemsSold: 0,
    }),
  );

  const lockedSale = await postJson(worker, env, "/api/conversations/sale", sellerJar, {
    conversationId: conversation.id,
    status: "in_transfer",
  });
  assert.equal(lockedSale.status, 409);

  const otherConfirm = await postJson(
    worker,
    env,
    "/api/conversations/sale",
    otherBuyerJar,
    { conversationId: otherConversation.id, status: "complete" },
  );
  assert.equal(otherConfirm.status, 409);

  const otherRead = await getJson(
    worker,
    env,
    `/api/conversations?id=${otherConversation.id}`,
    otherBuyerJar,
  );
  assert.equal(otherRead.status, 200);
  assert.equal((await otherRead.json()).conversation.completed, false);

  const account = await workerFetch(worker, env, "/account", {
    headers: { accept: "text/html" },
    cookieJar: sellerJar,
  });
  assert.equal(account.status, 200);
  const html = await account.text();
  assert.match(html, />Messages</);
  assert.match(html, />History</);
  assert.match(html, /Social Credit/);
});

test("PayPal pay links use the seller-editable sale price and default to Goods and Services", async () => {
  const d1 = createMemoryD1();
  applyMarketplaceMigrations(d1);
  const worker = await loadWorker("chat-paypal-sale-price");
  const env = createTestEnv(d1);
  const sellerJar = new Map();
  const buyerJar = new Map();

  await signUp(worker, env, {
    name: "Seller Reed",
    email: "seller-paypal-price@example.com",
  });
  await signIn(worker, env, sellerJar, { email: "seller-paypal-price@example.com" });
  await signUp(worker, env, {
    name: "Buyer Lane",
    email: "buyer-paypal-price@example.com",
  });
  await signIn(worker, env, buyerJar, { email: "buyer-paypal-price@example.com" });

  const saved = await putJson(worker, env, "/api/account/profile", sellerJar, {
    paymentDestinations: [
      { rail: "paypal", destination: "seller-paypal@example.com" },
    ],
  });
  assert.equal(saved.status, 200);

  const published = await postJson(
    worker,
    env,
    "/api/listings",
    sellerJar,
    listingWrite("PayPal lamp"),
  );
  assert.equal(published.status, 201);
  const listing = (await published.json()).listing;

  const started = await postJson(worker, env, "/api/conversations", buyerJar, {
    listingId: listing.id,
  });
  assert.equal(started.status, 201);
  const conversation = (await started.json()).conversation;
  assert.equal(conversation.salePriceCents, 4200);
  assert.equal(conversation.buyerMarksSafe, false);
  assert.equal(conversation.paypalKind, "goods_and_services");
  assert.equal(conversation.paypalDestination, "seller-paypal@example.com");
  assert.match(conversation.paypalPayHref, /cmd=_xclick/);
  assert.match(conversation.paypalPayHref, /amount=42\.00/);
  assert.match(conversation.paypalPayHref, /item_name=PayPal\+lamp/);

  const buyerPrice = await postJson(worker, env, "/api/conversations/paypal", buyerJar, {
    conversationId: conversation.id,
    salePriceCents: 5500,
  });
  assert.equal(buyerPrice.status, 403);

  const sellerSafe = await postJson(worker, env, "/api/conversations/paypal", sellerJar, {
    conversationId: conversation.id,
    buyerMarksSafe: true,
  });
  assert.equal(sellerSafe.status, 403);

  const sellerPrice = await postJson(worker, env, "/api/conversations/paypal", sellerJar, {
    conversationId: conversation.id,
    salePriceCents: 5500,
  });
  assert.equal(sellerPrice.status, 200);
  const priced = (await sellerPrice.json()).conversation;
  assert.equal(priced.salePriceCents, 5500);
  assert.match(priced.paypalPayHref, /amount=55\.00/);
  assert.match(priced.paypalPayHref, /cmd=_xclick/);

  const buyerSafe = await postJson(worker, env, "/api/conversations/paypal", buyerJar, {
    conversationId: conversation.id,
    buyerMarksSafe: true,
  });
  assert.equal(buyerSafe.status, 200);
  const safe = (await buyerSafe.json()).conversation;
  assert.equal(safe.buyerMarksSafe, true);
  assert.equal(safe.paypalKind, "friends_and_family");
  assert.match(safe.paypalPayHref, /\/myaccount\/transfer\/homepage\/pay/);
  assert.match(safe.paypalPayHref, /amount=55\.00/);
  assert.doesNotMatch(safe.paypalPayHref, /cmd=_xclick/);
});
