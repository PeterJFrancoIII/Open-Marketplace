import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

test("pay-to links stay on public rails and official hosts", async () => {
  const [links, marketplace] = await Promise.all([
    readFile(new URL("../lib/payment-links.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/marketplace.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(links, /bitcoin:\$\{value\}/);
  assert.match(links, new RegExp(`ethereum:\\$\\{USDT_ETHEREUM\\}@1/transfer\\?address=\\$\\{value\\}`));
  assert.match(links, new RegExp(`ethereum:\\$\\{USDC_ETHEREUM\\}@1/transfer\\?address=\\$\\{value\\}`));
  assert.match(links, new RegExp(USDT, "i"));
  assert.match(links, new RegExp(USDC, "i"));
  assert.match(links, /https:\/\/www\.paypal\.com\//);
  assert.match(links, /https:\/\/venmo\.com\//);
  assert.match(links, /https:\/\/cash\.app\//);
  assert.doesNotMatch(links, /coinbase|binance|kraken|walletconnect|oauth/i);
  assert.doesNotMatch(links, /private key|seed phrase/i);

  assert.match(marketplace, /Pay the seller/);
  assert.match(marketplace, /does not send, hold, escrow, convert, or protect/);
  assert.match(marketplace, /paymentLinksFor/);
  assert.match(marketplace, /PayPalListingFact/);
  assert.match(marketplace, /rail !== "paypal"/);
  assert.match(marketplace, /URLSearchParams\(window\.location\.search\)\.get\("listing"\)/);
  assert.match(marketplace, /get\("edit"\)/);
  assert.match(marketplace, /Edit listing/);
  assert.match(marketplace, /method: editingListingId \? "PATCH" : "POST"/);
  assert.doesNotMatch(marketplace, /coinbase|binance|kraken/i);
});
