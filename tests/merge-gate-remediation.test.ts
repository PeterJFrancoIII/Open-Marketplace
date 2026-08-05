import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTransactionEvent,
  assertSameOriginRelativeReturnTo,
  AuthError,
  actorFromProfileId,
  buildSignedTrustEvent,
  createProposedTransaction,
  generateRegistryKeyPair,
  InvalidTrustTransitionError,
  mintSessionToken,
  parseActor,
  parseStrictExternalCredential,
  parseStrictListingWrite,
  requireMatchingRegistryKeypair,
  requireSessionSecret,
} from "../lib/trust/index.ts";

const SESSION_SECRET = "test-session-secret-32-chars-min!!";

async function sessionRequest(profileId: string, extraHeaders: Record<string, string> = {}) {
  const token = await mintSessionToken(profileId, SESSION_SECRET);
  return new Request("http://local/test", {
    headers: {
      authorization: `Session ${token}`,
      ...extraHeaders,
    },
  });
}

test("blocker1: header-only identity is rejected", async () => {
  await assert.rejects(
    () =>
      parseActor(
        new Request("http://x", { headers: { "x-profile-id": "device:attacker" } }),
        null,
        SESSION_SECRET,
      ),
    /session required/i,
  );
});

test("blocker1: signed session authorizes actor", async () => {
  const actor = await parseActor(
    await sessionRequest("device:abc12345deadbeef"),
    null,
    SESSION_SECRET,
  );
  assert.equal(actor.profileId, "device:abc12345deadbeef");
  assert.equal(actor.authMethod, "session");
});

test("blocker1: short SESSION_SECRET disables protected mutations", () => {
  assert.throws(() => requireSessionSecret("too-short"), AuthError);
});

test("blocker2: listing schema rejects data URLs and unknown media fields", () => {
  assert.throws(
    () =>
      parseStrictListingWrite({
        title: "Bike",
        description: "Nice",
        priceCents: 100,
        condition: "Good",
        category: "Sporting goods",
        locationLabel: "Town",
        sellerName: "Sam",
        imageManifest: [
          {
            contentHash: "a".repeat(64),
            mimeType: "image/jpeg",
            filename: "x.jpg",
            byteLength: 12,
            imageData: "data:image/png;base64,AAAA",
          },
        ],
      }),
    /Forbidden media field|data\/blob/i,
  );

  assert.throws(
    () =>
      parseStrictListingWrite({
        title: "Bike",
        description: "Nice",
        priceCents: 100,
        condition: "Good",
        category: "Sporting goods",
        locationLabel: "Town",
        sellerName: "Sam",
        socialProofs: [
          {
            provider: "facebook",
            url: "https://facebook.com/x",
            bytes: Array.from({ length: 64 }, (_, i) => i),
          },
        ],
        imageManifest: [],
      }),
    /numeric byte array|Forbidden media field/i,
  );

  assert.throws(
    () =>
      parseStrictListingWrite({
        title: "Bike",
        description: "Nice",
        priceCents: 100,
        condition: "Good",
        category: "Sporting goods",
        locationLabel: "Town",
        sellerName: "Sam",
        socialProofs: [
          {
            provider: "facebook",
            url: "https://facebook.com/x",
            nestedEvil: { bytes: [1, 2, 3, 4] },
          },
        ],
        imageManifest: [],
      }),
    /Forbidden media field|numeric byte array/i,
  );

  const ok = parseStrictListingWrite({
    title: "Bike",
    description: "Nice",
    priceCents: 100,
    condition: "Good",
    category: "Sporting goods",
    locationLabel: "Town",
    sellerName: "Sam",
    evilExtra: "strip-me",
    socialProofs: [
      {
        provider: "facebook",
        url: "https://facebook.com/x",
        handle: "x",
        ignoredField: "gone",
      },
    ],
    imageManifest: [
      {
        // Browser vault shape aliases must be accepted.
        hash: `sha256:${"ab".repeat(32)}`,
        name: "x.jpg",
        size: 12,
        type: "image/jpeg",
        unknown: "ignored",
      },
    ],
  });
  assert.equal(ok.imageManifest[0].contentHash, "ab".repeat(32));
  assert.equal(ok.socialProofs[0].handle, "x");
  assert.equal("ignoredField" in ok.socialProofs[0], false);
  assert.equal("evilExtra" in ok, false);
});

test("blocker2: external credential strips nested unknowns and rejects byte arrays", () => {
  assert.throws(
    () =>
      parseStrictExternalCredential({
        type: ["VerifiableCredential"],
        issuer: "did:example:1",
        credentialSubject: { id: "p1", base64: "AAAA".repeat(80) },
      }),
    /Forbidden media field|base64/i,
  );

  assert.throws(
    () =>
      parseStrictExternalCredential({
        type: ["VerifiableCredential"],
        issuer: "did:example:1",
        credentialSubject: {
          id: "p1",
          claimType: "sellerAggregateRating",
          value: { pixels: Array.from({ length: 40 }, (_, i) => i) },
        },
      }),
    /numeric byte array/i,
  );

  assert.throws(
    () =>
      parseStrictExternalCredential({
        type: ["VerifiableCredential"],
        issuer: "did:example:1",
        credentialSubject: {
          id: "p1",
          claimType: "sellerAggregateRating",
          value: 4.5,
          smuggledBytes: Array.from({ length: 8 }, (_, i) => i),
        },
      }),
    /numeric byte array|Forbidden media field/i,
  );

  const strict = parseStrictExternalCredential({
    type: ["VerifiableCredential"],
    issuer: "did:example:1",
    credentialSubject: {
      id: "p1",
      claimType: "sellerAggregateRating",
      value: 4.5,
      ignored: "strip-me",
    },
    evilTop: "strip-me-too",
  });
  const subject = strict.credentialSubject as Record<string, unknown>;
  assert.equal(subject.claimType, "sellerAggregateRating");
  assert.equal("ignored" in subject, false);
  assert.equal("evilTop" in strict, false);
});

test("blocker3: complete requires independent buyer+seller attestations", () => {
  let tx = createProposedTransaction({
    id: "t-complete",
    listingId: "l1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
  });
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actorFromProfileId("seller-1"),
    event: { type: "accept" },
  }).transaction;
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actorFromProfileId("seller-1"),
    event: { type: "mark_fulfilled" },
  }).transaction;
  assert.throws(
    () =>
      applyTransactionEvent({
        transaction: tx,
        actor: actorFromProfileId("buyer-1"),
        event: { type: "complete" },
      }),
    /Both buyer and seller attestations/i,
  );

  tx = applyTransactionEvent({
    transaction: tx,
    actor: actorFromProfileId("seller-1"),
    event: { type: "issue_meetup_nonce" },
  }).transaction;
  const nonce = tx.meetupNonce!;
  tx = applyTransactionEvent({
    transaction: tx,
    actor: actorFromProfileId("buyer-1"),
    event: { type: "confirm_meetup", meetupNonce: nonce },
  }).transaction;
  // Still missing seller attestation
  assert.throws(
    () =>
      applyTransactionEvent({
        transaction: tx,
        actor: actorFromProfileId("buyer-1"),
        event: { type: "complete" },
      }),
    /Both buyer and seller attestations/i,
  );
});

test("blocker4: buildSignedTrustEvent never emits unsigned provenance", async () => {
  const keys = await generateRegistryKeyPair();
  const prev = {
    REGISTRY_SIGNING_PRIVATE_JWK: process.env.REGISTRY_SIGNING_PRIVATE_JWK,
    NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK:
      process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK,
    NEXT_PUBLIC_REGISTRY_ID: process.env.NEXT_PUBLIC_REGISTRY_ID,
  };
  process.env.REGISTRY_SIGNING_PRIVATE_JWK = JSON.stringify(keys.privateJwk);
  process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK = JSON.stringify(keys.publicJwk);
  process.env.NEXT_PUBLIC_REGISTRY_ID = "registry-test";
  try {
    const envelope = await buildSignedTrustEvent({
      eventId: "e-signed",
      subjectProfileId: "seller-1",
      eventType: "review.sealed",
      occurredAt: "2026-08-05T00:00:00.000Z",
      payload: { reviewId: "r1", score: 5 },
    });
    assert.doesNotMatch(envelope.signature, /^unsigned:/);
    assert.match(envelope.payloadHash, /^[a-f0-9]{64}$/);
  } finally {
    process.env.REGISTRY_SIGNING_PRIVATE_JWK = prev.REGISTRY_SIGNING_PRIVATE_JWK;
    process.env.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK =
      prev.NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK;
    process.env.NEXT_PUBLIC_REGISTRY_ID = prev.NEXT_PUBLIC_REGISTRY_ID;
  }
});

test("blocker5: returnTo must be same-origin relative", () => {
  assert.equal(assertSameOriginRelativeReturnTo("/settings"), "/settings");
  assert.throws(() => assertSameOriginRelativeReturnTo("https://evil.example/"), InvalidTrustTransitionError);
  assert.throws(() => assertSameOriginRelativeReturnTo("//evil.example"), InvalidTrustTransitionError);
  assert.throws(() => assertSameOriginRelativeReturnTo("\\evil"), InvalidTrustTransitionError);
});

test("blocker6: mismatched registry JWKs fail closed", async () => {
  const a = await generateRegistryKeyPair();
  const b = await generateRegistryKeyPair();
  await assert.rejects(
    () =>
      requireMatchingRegistryKeypair({
        REGISTRY_SIGNING_PRIVATE_JWK: JSON.stringify(a.privateJwk),
        NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK: JSON.stringify(b.publicJwk),
        NEXT_PUBLIC_REGISTRY_ID: "x",
      }),
    /not the same keypair|failed sign\/verify/i,
  );
  await assert.rejects(
    () =>
      requireMatchingRegistryKeypair({
        REGISTRY_SIGNING_PRIVATE_JWK: null,
        NEXT_PUBLIC_REGISTRY_SIGNING_PUBLIC_JWK: JSON.stringify(a.publicJwk),
      }),
    /required/i,
  );
});
