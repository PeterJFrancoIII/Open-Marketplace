import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function fetchPrivacyHtml() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("privacy", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/privacy", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      DB: undefined,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("privacy page source stays public and does not import auth or data stores", async () => {
  const source = await readFile(
    new URL("../app/privacy/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /id=["']facebook-data-deletion["']/);
  assert.doesNotMatch(source, /from ["'].*lib\/auth/);
  assert.doesNotMatch(source, /from ["'].*\/db/);
  assert.doesNotMatch(source, /requireMarketplaceSession|getDb|authClient|FacebookProvider|socialProviders/);
  assert.doesNotMatch(source, /from ["']better-auth/);
});

test("renders a public unauthenticated /privacy policy", async () => {
  const response = await fetchPrivacyHtml();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<h1[^>]*>Privacy Policy<\/h1>/i);
  assert.match(html, /id=["']identity-and-scope["']/);
  assert.match(html, /independent marketplace/i);
  assert.match(html, /external account providers, not the operator/i);
  assert.match(html, /Better Auth/i);
  assert.match(html, /payment-destination/i);
  assert.match(html, /Listing image bytes remain on the seller/i);
  assert.match(html, /content hashes/i);
  assert.match(html, /Facebook Connect is not yet enabled/i);
  assert.match(html, /public_profile/);
  assert.match(html, /OM-DEC-017/);
  assert.match(html, /Connected status/i);
  assert.match(html, /Facebook email permission/i);
  assert.match(html, /server-side/i);
  assert.match(html, /does not sell Facebook profile data/i);
  assert.match(html, /has not adopted a fixed legal retention period/i);
  assert.match(html, /id=["']facebook-data-deletion["']/);
  assert.match(html, /does not yet offer Disconnect/i);
  assert.match(html, /will provide Disconnect/i);
  assert.match(html, /private privacy-request contact channel will be published/i);
  assert.match(html, /2026-08-14/);
  assert.match(html, /href=["']#facebook-data-deletion["']/);
  assert.doesNotMatch(html, /Log in to Open Marketplace/i);
  assert.doesNotMatch(html, /government-identity verification, or any “Facebook verified” label[\s\S]*Open Marketplace (claims|provides)/i);
  assert.doesNotMatch(html, /Facebook Login for Business|Marketplace Platform|scrape Facebook/i);
  assert.doesNotMatch(html, /privacy@[a-z0-9.-]+/i);
  assert.doesNotMatch(html, /data broker|sells? (your )?data to advertisers/i);
  assert.doesNotMatch(html, /Disconnect is available in Account Settings/i);
});
