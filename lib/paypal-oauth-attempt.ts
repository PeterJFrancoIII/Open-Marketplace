import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { authUsers, authVerifications } from "../db/schema";

const PAYPAL_OAUTH_ATTEMPT_PREFIX = "paypal-oauth:";

export type PaypalOAuthAttempt = {
  userId: string;
  redirectUri: string;
  returnOrigin: string;
};

function allowedMarketplaceHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "open-marketplace-demo.pages.dev" ||
    host.endsWith(".open-marketplace-demo.pages.dev") ||
    host === "localhost"
  );
}

function normalizeMarketplaceOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!allowedMarketplaceHost(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/") return null;
    if (url.hostname === "localhost") {
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    } else if (url.protocol !== "https:") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function normalizePaypalRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (!allowedMarketplaceHost(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/api/paypal/callback") return null;
    if (url.hostname === "localhost") {
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    } else if (url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function storePaypalOAuthAttempt(input: {
  userId: string;
  nonce: string;
  redirectUri: string;
  returnOrigin: string;
  expiresAt: number;
}) {
  const redirectUri = normalizePaypalRedirectUri(input.redirectUri);
  const returnOrigin = normalizeMarketplaceOrigin(input.returnOrigin);
  if (!input.userId || !input.nonce || !redirectUri || !returnOrigin) {
    throw new Error("Invalid PayPal OAuth attempt.");
  }

  const db = await getDb();
  const now = new Date();
  await db.insert(authVerifications).values({
    id: crypto.randomUUID(),
    identifier: `${PAYPAL_OAUTH_ATTEMPT_PREFIX}${input.nonce}`,
    value: JSON.stringify({
      userId: input.userId,
      redirectUri,
      returnOrigin,
    } satisfies PaypalOAuthAttempt),
    expiresAt: new Date(input.expiresAt),
    createdAt: now,
    updatedAt: now,
  });
}

export async function consumePaypalOAuthAttempt(
  nonce: string,
  now = Date.now(),
): Promise<PaypalOAuthAttempt | null> {
  if (!nonce) return null;
  const db = await getDb();
  const identifier = `${PAYPAL_OAUTH_ATTEMPT_PREFIX}${nonce}`;
  const [row] = await db
    .select({
      id: authVerifications.id,
      value: authVerifications.value,
      expiresAt: authVerifications.expiresAt,
    })
    .from(authVerifications)
    .where(eq(authVerifications.identifier, identifier))
    .limit(1);

  if (!row) return null;
  await db.delete(authVerifications).where(eq(authVerifications.id, row.id));
  if (row.expiresAt.getTime() < now) return null;

  try {
    const parsed = JSON.parse(row.value) as Partial<PaypalOAuthAttempt>;
    const redirectUri =
      typeof parsed.redirectUri === "string"
        ? normalizePaypalRedirectUri(parsed.redirectUri)
        : null;
    const returnOrigin =
      typeof parsed.returnOrigin === "string"
        ? normalizeMarketplaceOrigin(parsed.returnOrigin)
        : null;
    if (
      typeof parsed.userId !== "string" ||
      !parsed.userId ||
      !redirectUri ||
      !returnOrigin
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      redirectUri,
      returnOrigin,
    };
  } catch {
    return null;
  }
}

export async function paypalOAuthDisplayName(userId: string) {
  const db = await getDb();
  const [user] = await db
    .select({ name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  return user?.name?.trim() || "Member";
}
