import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoSecretsInPublicPayload,
  createMemoryOAuthSessionStore,
  createMemoryProviderGrantStore,
  createMockSocialAdapter,
  createOAuthService,
  OAuthError,
  openTokenBundle,
  parseEncryptionKey,
  publicProofFromConnection,
  randomEncryptionKeyHex,
  sealTokenBundle,
} from "../lib/trust/index.ts";

const key = randomEncryptionKeyHex();

function service(options?: { supplyConnectionCount?: boolean }) {
  return createOAuthService({
    adapters: {
      facebook: createMockSocialAdapter({
        supplyAccountCreatedAt: true,
        supplyConnectionCount: options?.supplyConnectionCount ?? false,
      }),
    },
    sessions: createMemoryOAuthSessionStore(),
    grants: createMemoryProviderGrantStore(),
    encryptionKey: key,
  });
}

test("encrypts provider tokens and refuses public secret leakage", async () => {
  const sealed = await sealTokenBundle(
    {
      accessToken: "EAA_secret_token",
      providerSubject: "subj-1",
      grantedScopes: ["public_profile"],
    },
    parseEncryptionKey(key),
  );
  assert.ok(sealed.ciphertext);
  assert.notEqual(sealed.ciphertext, "EAA_secret_token");
  const opened = await openTokenBundle(sealed, parseEncryptionKey(key));
  assert.equal(opened.accessToken, "EAA_secret_token");
  assert.throws(
    () => assertNoSecretsInPublicPayload({ accessToken: "EAA_secret_token" }),
    OAuthError,
  );
});

test("PKCE begin/complete verifies provider without inventing friend counts", async () => {
  const oauth = service({ supplyConnectionCount: false });
  const began = await oauth.begin({
    profileId: "device:seller01",
    provider: "facebook",
    redirectUri: "http://localhost/api/oauth/facebook/callback",
    returnTo: "/?tab=sell",
  });
  assert.match(began.authorizationUrl, /code_challenge=/);
  assert.doesNotMatch(began.authorizationUrl, /code_verifier|access_token|EAA_/i);

  const completed = await oauth.complete({
    provider: "facebook",
    code: "mock:mina",
    state: began.state,
  });
  assert.equal(completed.connection.status, "oauth_verified");
  assert.equal(completed.connection.accountCreatedAtSource, "provider");
  assert.equal(completed.connection.connectionCount, undefined);
  assert.ok(completed.claimsOmitted.includes("connectionCount"));
  assert.equal(completed.returnTo, "/?tab=sell");
  assert.doesNotMatch(JSON.stringify(completed), /mock-access|accessToken|refreshToken/);

  const proof = publicProofFromConnection(completed.connection);
  assert.equal(proof.metricsSource, "oauth");
});

test("missing scopes/fields degrade honestly and self-reported never gets provider badge", async () => {
  const oauth = service({ supplyConnectionCount: false });
  const began = await oauth.begin({
    profileId: "device:seller02",
    provider: "facebook",
    redirectUri: "http://localhost/callback",
    returnTo: "/",
  });
  const completed = await oauth.complete({
    provider: "facebook",
    code: "mock:pat",
    state: began.state,
    existingConnection: {
      id: "soc1",
      profileId: "device:seller02",
      provider: "facebook",
      canonicalUrl: "https://facebook.com/self",
      connectionCount: 999,
      connectionCountSource: "self_reported",
      consecutiveDefinitiveFailures: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      status: "live",
    },
  });
  // Provider did not supply count — keep prior self-reported, do not mark provider.
  assert.equal(completed.connection.connectionCount, 999);
  assert.equal(completed.connection.connectionCountSource, "self_reported");
  assert.ok(completed.claimsOmitted.includes("connectionCount"));
});

test("disconnect revokes grant, clears ciphertext, and drops oauth_verified", async () => {
  const grants = createMemoryProviderGrantStore();
  const oauth = createOAuthService({
    adapters: { facebook: createMockSocialAdapter() },
    sessions: createMemoryOAuthSessionStore(),
    grants,
    encryptionKey: key,
  });
  const began = await oauth.begin({
    profileId: "device:seller03",
    provider: "facebook",
    redirectUri: "http://localhost/callback",
    returnTo: "/",
  });
  const completed = await oauth.complete({
    provider: "facebook",
    code: "mock:lee",
    state: began.state,
  });
  const before = await grants.getActive("device:seller03", "facebook");
  assert.ok(before?.grant.ciphertext);

  const disconnected = await oauth.disconnect({
    profileId: "device:seller03",
    provider: "facebook",
    connection: completed.connection,
  });
  assert.equal(disconnected.connection.status, "live");
  assert.equal(disconnected.grant?.status, "revoked");
  const after = await grants.getForProfileProvider("device:seller03", "facebook");
  assert.equal(after?.status, "revoked");
  assert.equal(after?.grant.ciphertext, "");
});

test("refresh backoff increases after failure", async () => {
  const failing = createMockSocialAdapter();
  const original = failing.refreshPublicClaims.bind(failing);
  let calls = 0;
  failing.refreshPublicClaims = async (tokens) => {
    calls += 1;
    if (calls === 1) return original(tokens);
    throw new OAuthError("provider rate limited", 429);
  };

  const grants = createMemoryProviderGrantStore();
  const oauth = createOAuthService({
    adapters: { facebook: failing },
    sessions: createMemoryOAuthSessionStore(),
    grants,
    encryptionKey: key,
  });
  const began = await oauth.begin({
    profileId: "device:seller04",
    provider: "facebook",
    redirectUri: "http://localhost/callback",
    returnTo: "/",
  });
  const completed = await oauth.complete({
    provider: "facebook",
    code: "mock:sam",
    state: began.state,
  });
  await assert.rejects(
    () =>
      oauth.refresh({
        profileId: "device:seller04",
        provider: "facebook",
        connection: completed.connection,
      }),
    /rate limited/i,
  );
  const stored = await grants.getActive("device:seller04", "facebook");
  assert.ok(stored);
  assert.equal(stored.refreshBackoffSeconds, 7200);
});
