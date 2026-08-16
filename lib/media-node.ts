const STORAGE_KEY = "open-marketplace-media-node";
const HASH_PATTERN = /^sha256:([a-f0-9]{64})$/i;

export type MediaNodeConfig = {
  origin: string;
  writeToken: string;
};

export function mediaHashHex(hash: string): string | null {
  const match = HASH_PATTERN.exec(hash.trim());
  return match ? match[1].toLowerCase() : null;
}

export function mediaNodeObjectPath(hash: string): string | null {
  const hex = mediaHashHex(hash);
  return hex ? `/media/sha256/${hex}` : null;
}

export function parseMediaNodeOrigin(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const localHttp =
    url.protocol === "http:" &&
    (host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local"));
  if (url.protocol !== "https:" && !localHttp) return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;
  return url.origin;
}

export function readMediaNodeConfig(): MediaNodeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MediaNodeConfig>;
    const origin = parseMediaNodeOrigin(String(parsed.origin ?? ""));
    if (!origin) return null;
    return {
      origin,
      writeToken: typeof parsed.writeToken === "string" ? parsed.writeToken : "",
    };
  } catch {
    return null;
  }
}

export function writeMediaNodeConfig(config: MediaNodeConfig | null) {
  if (typeof window === "undefined") return;
  if (!config) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const origin = parseMediaNodeOrigin(config.origin);
  if (!origin) {
    throw new Error("Enter an https media-node origin, or http://localhost for local testing.");
  }
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      origin,
      writeToken: config.writeToken.trim(),
    }),
  );
}

export function toSha256Hash(buffer: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest("SHA-256", buffer).then((digest) => {
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `sha256:${hex}`;
  });
}

export async function assertBlobMatchesHash(hash: string, blob: Blob) {
  const expected = mediaHashHex(hash);
  if (!expected) throw new Error("Media hash is not a sha256 digest.");
  const actual = mediaHashHex(await toSha256Hash(await blob.arrayBuffer()));
  if (actual !== expected) {
    throw new Error("Media node returned bytes that do not match the listing hash.");
  }
}

export async function fetchMediaFromNode(
  origin: string,
  hash: string,
): Promise<Blob | null> {
  const parsedOrigin = parseMediaNodeOrigin(origin);
  const path = mediaNodeObjectPath(hash);
  if (!parsedOrigin || !path) return null;
  const response = await fetch(`${parsedOrigin}${path}`, {
    headers: { accept: "application/octet-stream" },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("The trusted media node could not return this photo.");
  }
  const blob = await response.blob();
  await assertBlobMatchesHash(hash, blob);
  return blob;
}

export async function publishMediaToNode(
  config: MediaNodeConfig,
  hash: string,
  blob: Blob,
): Promise<void> {
  const origin = parseMediaNodeOrigin(config.origin);
  const path = mediaNodeObjectPath(hash);
  if (!origin || !path) {
    throw new Error("The trusted media node origin is not valid.");
  }
  if (!config.writeToken.trim()) {
    throw new Error("A write token is required to copy photos onto the media node.");
  }
  await assertBlobMatchesHash(hash, blob);
  const response = await fetch(`${origin}${path}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${config.writeToken.trim()}`,
      "content-type": blob.type || "application/octet-stream",
    },
    body: blob,
  });
  if (!response.ok) {
    throw new Error("The trusted media node rejected the photo copy.");
  }
}

export async function probeMediaNode(origin: string): Promise<boolean> {
  const parsedOrigin = parseMediaNodeOrigin(origin);
  if (!parsedOrigin) return false;
  const response = await fetch(`${parsedOrigin}/health`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { ok?: unknown; role?: unknown };
  return body.ok === true && body.role === "trusted-media-node";
}
