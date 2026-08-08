function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomUrlSafe(byteLength = 32): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function createPkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  nonce: string;
}> {
  const codeVerifier = randomUrlSafe(48);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return {
    codeVerifier,
    codeChallenge: bytesToBase64Url(new Uint8Array(digest)),
    state: randomUrlSafe(24),
    nonce: randomUrlSafe(24),
  };
}

export function sessionExpiry(now = new Date(), ttlMinutes = 10): string {
  return new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
}
