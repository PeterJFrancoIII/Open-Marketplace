import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { authUsers, authVerifications } from "../db/schema";
import type { PaypalOAuthLastReturn } from "./types";

const PAYPAL_OAUTH_ATTEMPT_PREFIX = "paypal-oauth:";
const PAYPAL_OAUTH_RESULT_PREFIX = "paypal-oauth-result:";
const RESULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

export function paypalCallbackOriginAllowed(origin: string) {
  return Boolean(normalizeMarketplaceOrigin(origin));
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

function isPaypalOAuthLastReturn(value: unknown): value is PaypalOAuthLastReturn {
  return (
    value === "started" ||
    value === "linked" ||
    value === "paypal" ||
    value === "paypal-state" ||
    value === "paypal-session" ||
    value === "paypal-token" ||
    value === "paypal-token-redirect" ||
    value === "paypal-token-client" ||
    value === "paypal-token-code" ||
    value === "paypal-token-request" ||
    value === "paypal-token-service"
  );
}

export async function recordPaypalOAuthResult(
  userId: string,
  status: PaypalOAuthLastReturn,
) {
  if (!userId || !isPaypalOAuthLastReturn(status)) return;
  const db = await getDb();
  const identifier = `${PAYPAL_OAUTH_RESULT_PREFIX}${userId}`;
  const now = new Date();
  const value = JSON.stringify({ status });
  const [existing] = await db
    .select({ id: authVerifications.id })
    .from(authVerifications)
    .where(eq(authVerifications.identifier, identifier))
    .limit(1);
  if (existing) {
    await db
      .update(authVerifications)
      .set({
        value,
        expiresAt: new Date(now.getTime() + RESULT_TTL_MS),
        updatedAt: now,
      })
      .where(eq(authVerifications.id, existing.id));
    return;
  }
  await db.insert(authVerifications).values({
    id: crypto.randomUUID(),
    identifier,
    value,
    expiresAt: new Date(now.getTime() + RESULT_TTL_MS),
    createdAt: now,
    updatedAt: now,
  });
}

export async function readPaypalOAuthResult(userId: string) {
  if (!userId) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      value: authVerifications.value,
      expiresAt: authVerifications.expiresAt,
    })
    .from(authVerifications)
    .where(eq(authVerifications.identifier, `${PAYPAL_OAUTH_RESULT_PREFIX}${userId}`))
    .limit(1);
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  try {
    const parsed = JSON.parse(row.value) as { status?: unknown };
    return isPaypalOAuthLastReturn(parsed.status) ? parsed.status : null;
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
