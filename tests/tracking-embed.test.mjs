import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  TRACKING_EMBED_SCRIPT,
  isOfficialTrackingHref,
  saleTrackingDetails,
} from "../lib/tracking-embed.ts";

test("sale tracking details detect official carriers and keep embeds on allowlisted hosts", () => {
  const ups = saleTrackingDetails("1Z999AA10123456784");
  assert.equal(ups?.carrier, "ups");
  assert.equal(ups?.kind, "carrier");
  assert.match(ups?.officialHref ?? "", /^https:\/\/www\.ups\.com\/track\?/);
  assert.match(ups?.officialHref ?? "", /tracknum=1Z999AA10123456784/);
  assert.equal(isOfficialTrackingHref(ups?.officialHref ?? null), true);
  assert.equal(isOfficialTrackingHref(ups?.aftershipHref ?? null), true);
  assert.equal(isOfficialTrackingHref(ups?.embedHref ?? null), true);
  assert.match(ups?.aftershipHref ?? "", /^https:\/\/www\.aftership\.com\/track\//);
  assert.match(ups?.embedHref ?? "", /^https:\/\/t\.17track\.net\/en\/track\?nums=/);

  const usps = saleTrackingDetails("9400111899223854123456");
  assert.equal(usps?.carrier, "usps");
  assert.match(usps?.officialHref ?? "", /^https:\/\/tools\.usps\.com\//);

  const fedex = saleTrackingDetails("123456789012");
  assert.equal(fedex?.carrier, "fedex");
  assert.match(fedex?.officialHref ?? "", /^https:\/\/www\.fedex\.com\/fedextrack\//);

  const dhl = saleTrackingDetails("1234567890");
  assert.equal(dhl?.carrier, "dhl");
  assert.match(dhl?.officialHref ?? "", /^https:\/\/www\.dhl\.com\//);

  const pickup = saleTrackingDetails("PICKUP");
  assert.equal(pickup?.kind, "pickup");
  assert.equal(pickup?.officialHref, null);
  assert.equal(pickup?.embedHref, null);

  assert.equal(saleTrackingDetails("https://evil.example/1Z999AA10123456784"), null);
  assert.equal(saleTrackingDetails("javascript:alert(1)"), null);
  assert.equal(isOfficialTrackingHref("https://evil.example/track"), false);
  assert.equal(TRACKING_EMBED_SCRIPT, "https://www.17track.net/externalcall.js");
});

test("messages attach 17TRACK updates to the tracking number field", async () => {
  const messagesUi = await readFile(
    new URL("../app/account/messages/messages-client.tsx", import.meta.url),
    "utf8",
  );
  assert.match(messagesUi, /Tracking updates/);
  assert.match(messagesUi, /TRACKING_EMBED_SCRIPT/);
  assert.match(messagesUi, /Open official/);
  assert.match(messagesUi, /Open AfterShip/);
  assert.doesNotMatch(messagesUi, /conversation_messages/);
});
