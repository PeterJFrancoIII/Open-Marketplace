import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function fetchHtml(path, label) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set(label, `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
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
  assert.match(source, /id=["']paypal-connect-disclosure["']/);
  assert.match(source, /asks for <code>openid<\/code> only/);
  assert.doesNotMatch(source, /asks for <code>openid<\/code>, <code>email<\/code>/);
  assert.doesNotMatch(source, /from ["'].*lib\/auth/);
  assert.doesNotMatch(source, /from ["'].*\/db/);
  assert.doesNotMatch(source, /requireMarketplaceSession|getDb|authClient|FacebookProvider|socialProviders/);
  assert.doesNotMatch(source, /from ["']better-auth/);
  assert.doesNotMatch(source, /OM-DEC-|Better Auth|agent handoff/i);

  const termsSource = await readFile(
    new URL("../app/terms/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    termsSource,
    /PayPal Login[\s\S]*does not sign you into Open Marketplace/,
  );
});

test("renders a public unauthenticated /privacy policy", async () => {
  const response = await fetchHtml("/privacy", "privacy");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<h1[^>]*>Privacy Policy<\/h1>/i);
  assert.match(html, /id=["']identity-and-scope["']/);
  assert.match(html, /independent marketplace/i);
  assert.match(html, /external account providers, not the operator/i);
  assert.match(html, /payment-destination/i);
  assert.match(html, /Listing image bytes remain on the seller/i);
  assert.match(html, /content hashes/i);
  assert.match(html, /Signed-in people can choose Connect/i);
  assert.match(html, /public_profile/);
  assert.match(html, /Connected/i);
  assert.match(html, /Facebook email permission/i);
  assert.match(html, /server-side/i);
  assert.match(html, /does not sell Facebook profile data/i);
  assert.match(html, /id=["']facebook-data-deletion["']/);
  assert.match(html, /Account Settings offers Disconnect now/i);
  assert.match(html, /leaves the Open Marketplace[\s\S]*account and session intact/i);
  assert.doesNotMatch(html, /non-production account preview/i);
  assert.doesNotMatch(html, /connection-scoped provider identity/i);
  assert.match(html, /22 August 2026/);
  assert.match(html, /id=["']paypal-connect-disclosure["']/);
  assert.match(html, /asks for <code>openid<\/code> only/);
  assert.match(html, /does not sell PayPal Login data/i);
  assert.match(html, /PayPal Login tokens[\s\S]*remain[\s\S]*server-side/);
  assert.doesNotMatch(html, /asks for <code>openid<\/code>, <code>email<\/code>/);
  assert.match(html, /user_hometown/);
  assert.match(html, /user_location/);
  assert.match(html, /TikTok Login Kit/);
  assert.match(html, /user\.info\.basic/);
  assert.match(html, /user\.info\.profile/);
  assert.match(html, /user\.info\.stats/);
  assert.match(html, /does not sell TikTok provider data/i);
  assert.match(html, /id=["']tiktok-data-deletion["']/);
  assert.match(html, /href=["']#facebook-data-deletion["']/);
  assert.match(html, /href=["']\/privacy\/facebook-data-deletion["']/);
  assert.match(html, /href=["']\/terms["']/);
  assert.doesNotMatch(html, /Log in to Open Marketplace/i);
  assert.doesNotMatch(html, /government-identity verification, or any “Facebook verified” label[\s\S]*Open Marketplace (claims|provides)/i);
  assert.doesNotMatch(html, /Facebook Login for Business|Marketplace Platform|scrape Facebook/i);
  assert.doesNotMatch(html, /privacy@[a-z0-9.-]+/i);
  assert.doesNotMatch(html, /data broker|sells? (your )?data to advertisers/i);
  assert.doesNotMatch(html, /Facebook Connect is not yet enabled/i);
  assert.doesNotMatch(html, /does not yet offer Disconnect/i);
  assert.doesNotMatch(html, /will provide Disconnect/i);
  assert.doesNotMatch(html, /OM-DEC-017|Better Auth|agent handoff/i);
  assert.doesNotMatch(html, /name=["']codex-preview["']/i);
});

test("renders public terms and Facebook data deletion instructions", async () => {
  const terms = await fetchHtml("/terms", "terms");
  assert.equal(terms.status, 200);
  const termsHtml = await terms.text();
  assert.match(termsHtml, /<h1[^>]*>Terms of Service<\/h1>/i);
  assert.match(termsHtml, /does not sign you into Open Marketplace/i);
  assert.match(termsHtml, /PayPal Login[\s\S]*does not sign you into Open Marketplace/i);
  assert.match(termsHtml, /22 August 2026/);
  assert.match(termsHtml, /Your responsibility for listings and transactions/i);
  assert.match(termsHtml, /Prohibited behavior/i);
  assert.match(termsHtml, /Intellectual property/i);
  assert.match(termsHtml, /Limitation of liability/i);
  assert.match(termsHtml, /Account suspension and termination/i);
  assert.match(termsHtml, /user\.info\.basic/);
  assert.match(termsHtml, /href=["']\/privacy\/facebook-data-deletion["']/);
  assert.doesNotMatch(termsHtml, /OM-DEC-|Better Auth|agent handoff/i);
  assert.doesNotMatch(termsHtml, /Continue with Facebook|Sign in with Facebook/i);

  const deletion = await fetchHtml(
    "/privacy/facebook-data-deletion",
    "facebook-deletion",
  );
  assert.equal(deletion.status, 200);
  const deletionHtml = await deletion.text();
  assert.match(deletionHtml, /<h1[^>]*>Facebook data deletion<\/h1>/i);
  assert.match(deletionHtml, /id=["']facebook-data-deletion["']/);
  assert.match(deletionHtml, /Account Settings offers Disconnect now/i);
  assert.match(deletionHtml, /Apps and Websites/i);
  assert.match(deletionHtml, /Send Request/i);
  assert.doesNotMatch(deletionHtml, /OM-DEC-|Better Auth|agent handoff/i);
  assert.doesNotMatch(deletionHtml, /connection-scoped provider identity/i);

  const status = await fetchHtml(
    "/privacy/facebook-data-deletion/status",
    "facebook-deletion-status",
  );
  assert.equal(status.status, 200);
  const statusHtml = await status.text();
  assert.match(statusHtml, /Confirmation code/i);
  assert.match(statusHtml, /name=["']code["']/);
  assert.doesNotMatch(statusHtml, /BETTER_AUTH_SECRET|OM-DEC-|agent handoff/i);
});
