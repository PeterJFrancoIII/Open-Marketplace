import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryTrustEventStore } from "../lib/trust/events.ts";
import {
  assertExportSafe,
  buildSignedTrustBundle,
  canonicalize,
  generateRegistryKeyPair,
  importExternalCredential,
  issueBoundedClaim,
  PortableTrustError,
  publicExternalEvidenceView,
  sha256Hex,
  verifyBoundedClaim,
  verifyTrustBundle,
  verifyTrustEventEnvelope,
} from "../lib/trust/portable/index.ts";

test("canonicalize is deterministic across key order", async () => {
  const a = canonicalize({ b: 1, a: { d: 2, c: 3 } });
  const b = canonicalize({ a: { c: 3, d: 2 }, b: 1 });
  assert.equal(a, b);
  assert.equal(await sha256Hex(a), await sha256Hex(b));
});

test("signed event envelopes verify with registry key", async () => {
  const keys = await generateRegistryKeyPair();
  const store = createMemoryTrustEventStore("registry-test", keys);
  const envelope = await Promise.resolve(
    store.append({
      eventId: "e1",
      subjectProfileId: "seller-1",
      eventType: "profile.created",
      occurredAt: "2026-08-05T00:00:00.000Z",
      payload: { standing: "new" },
      schemaVersion: 2,
      registryId: "registry-test",
    }),
  );
  assert.doesNotMatch(envelope.signature, /^unsigned:/);
  assert.equal(await verifyTrustEventEnvelope({ envelope, publicKey: keys.publicKey }), true);
});

test("bounded VC claims sign, verify, expire, and revoke", async () => {
  const keys = await generateRegistryKeyPair();
  const credential = await issueBoundedClaim({
    claim: {
      profileId: "seller-1",
      claimType: "sellerCompletedTransactions",
      value: 25,
      unit: "count",
    },
    registryId: "registry-test",
    privateKey: keys.privateKey,
    keyId: keys.keyId,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.equal(credential.credentialSubject.evidenceLabel, "native_registry");
  assert.ok(credential.proof?.proofValue);

  const ok = await verifyBoundedClaim({
    credential,
    publicKey: keys.publicKey,
    now: new Date("2026-06-01T00:00:00.000Z"),
  });
  assert.equal(ok.ok, true);

  const expired = await verifyBoundedClaim({
    credential,
    publicKey: keys.publicKey,
    now: new Date("2028-01-02T00:00:00.000Z"),
  });
  assert.equal(expired.ok, false);
  assert.equal(expired.status, "expired");

  const revoked = await verifyBoundedClaim({
    credential,
    publicKey: keys.publicKey,
    now: new Date("2026-06-01T00:00:00.000Z"),
    revokedIds: new Set([credential.id]),
  });
  assert.equal(revoked.ok, false);
  assert.equal(revoked.status, "revoked");
});

test("export bundle omits private material and verifies as a whole", async () => {
  const keys = await generateRegistryKeyPair();
  const store = createMemoryTrustEventStore("registry-test", keys);
  await Promise.resolve(
    store.append({
      eventId: "e1",
      subjectProfileId: "seller-1",
      eventType: "transaction.completed",
      occurredAt: "2026-08-01T00:00:00.000Z",
      payload: { count: 1 },
      schemaVersion: 2,
      registryId: "registry-test",
    }),
  );

  const bundle = await buildSignedTrustBundle({
    registryId: "registry-test",
    keyId: keys.keyId,
    privateKey: keys.privateKey,
    subjectProfileId: "seller-1",
    events: store.listForSubject("seller-1"),
    snapshot: {
      memberSince: "2024-01-01T00:00:00.000Z",
      sellerCompletedSales: 25,
      sellerDisplayMean: 4.8,
      sellerRatingCount: 23,
      buyerDisplayMean: null,
      buyerRatingCount: 0,
      providerConnectedAt: "2026-07-01T00:00:00.000Z",
    },
  });

  assertExportSafe(bundle);
  assert.doesNotMatch(JSON.stringify(bundle), /accessToken|reviewBody|disputeEvidence/i);
  assert.ok(bundle.credentials.some((c) => c.credentialSubject.claimType === "sellerAggregateRating"));

  const verified = await verifyTrustBundle({
    bundle,
    publicKey: keys.publicKey,
  });
  assert.equal(verified.ok, true);
  assert.equal(verified.bundleSignatureValid, true);
  assert.equal(verified.eventsValid, true);

  const tampered = structuredClone(bundle);
  tampered.events[0] = {
    ...tampered.events[0],
    signature: "invalid-event-signature",
  };
  // Re-sign bundle so only the event signature is wrong.
  const { signCanonical } = await import("../lib/trust/portable/keys.ts");
  const { proof: _drop, ...unsigned } = tampered;
  void _drop;
  const proofValue = await signCanonical(keys.privateKey, unsigned);
  tampered.proof = { ...bundle.proof, proofValue };
  const badEvent = await verifyTrustBundle({
    bundle: tampered,
    publicKey: keys.publicKey,
  });
  assert.equal(badEvent.ok, false);
  assert.equal(badEvent.eventsValid, false);
  assert.ok(badEvent.reasons.some((r) => /signature invalid/i.test(r)));

  assert.throws(
    () => assertExportSafe({ accessToken: "secret-token-value" }),
    PortableTrustError,
  );
});

test("external claims stay labeled and never become native ratings", async () => {
  const keys = await generateRegistryKeyPair();
  const native = await issueBoundedClaim({
    claim: {
      profileId: "seller-1",
      claimType: "sellerCompletedTransactions",
      value: 10,
    },
    registryId: "other-registry",
    privateKey: keys.privateKey,
    keyId: keys.keyId,
  });
  const externalCredential = {
    ...native,
    credentialSubject: {
      ...native.credentialSubject,
      evidenceLabel: "external" as const,
    },
  };
  // Re-sign after label change would be needed for ok verify; import still forces external.
  const evidence = importExternalCredential({
    id: "ext1",
    profileId: "seller-1",
    sourceLabel: "partner-market",
    credential: externalCredential,
    signatureVerified: false,
  });
  assert.equal(evidence.evidenceLabel, "external");
  assert.equal(evidence.status, "unverified");
  const view = publicExternalEvidenceView(evidence);
  assert.equal(view.evidenceLabel, "external");
  assert.equal("rawCredentialJson" in view, false);
});
