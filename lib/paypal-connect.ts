import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { authAccounts, profiles } from "../db/schema";
import { getMarketplaceSession } from "./auth";
import {
  parsePaymentDestinationsJson,
} from "./payment-destinations";
import { paypalMeHandle } from "./paypal-pay-link";
import {
  mergePaypalIdentity,
  parsePaypalIdToken,
  parsePaypalIdentity,
  paypalApiOrigin,
  paypalOauthDestination,
  paypalUserInfoUrls,
  paypalUsesLiveEnv,
} from "./paypal-public";
import { parseShippingBrokersJson, serializePaymentBundle } from "./shipping-brokers";
import type { PayPalConnection, PaymentDestination } from "./types";

export {
  PAYPAL_CONNECT_SCOPES,
  PAYPAL_ME_SETUP_URL,
  PAYPAL_PAYER_ATTRIBUTE_SCOPE,
  mergePaymentDestinationsForSave,
  mergePaypalIdentity,
  overlayPaypalDestinations,
  parsePaypalIdToken,
  parsePaypalIdentity,
  parsePaypalUserInfo,
  payerIdFromPaypalIdToken,
  paypalAuthorizeUrl,
  paypalMeFromUserInfo,
  paypalMePublicUrl,
  paypalOauthDestination,
  paypalPublicPayTo,
  paypalUserInfoUrls,
} from "./paypal-public";

export const PAYPAL_OAUTH_COOKIE = "om_paypal_oauth";
const STATE_TTL_MS = 60 * 60 * 1000;

type PaypalEnv = {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_ENV?: string;
  BETTER_AUTH_SECRET?: string;
};

async function readPaypalEnv(): Promise<PaypalEnv> {
  const { env } = await import("cloudflare:workers");
  return env as PaypalEnv;
}

export async function getPayPalConnectAvailability() {
  const env = await readPaypalEnv();
  return Boolean(env.PAYPAL_CLIENT_ID?.trim() && env.PAYPAL_CLIENT_SECRET?.trim());
}

function publicPayPalConnection(
  available: boolean,
  connected: boolean,
  destination: string | null = null,
): PayPalConnection {
  const handle = destination ? paypalMeHandle(destination) : null;
  const email =
    !handle && destination && destination.includes("@")
      ? destination.trim().toLowerCase()
      : null;
  return {
    available,
    connected,
    email: connected ? email : null,
    paypalMe: connected ? handle : null,
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signPaypalOAuthState(
  payload: { userId: string; nonce: string; exp: number },
  secret: string,
) {
  const body = JSON.stringify(payload);
  const key = await hmacKey(secret);
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  return `${bytesToBase64Url(new TextEncoder().encode(body))}.${bytesToBase64Url(signature)}`;
}

export async function verifyPaypalOAuthState(
  state: string,
  secret: string,
  now = Date.now(),
) {
  const [bodyPart, signaturePart] = state.split(".");
  if (!bodyPart || !signaturePart) return null;
  const bodyBytes = base64UrlToBytes(bodyPart);
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signaturePart),
    bodyBytes,
  );
  if (!valid) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bodyBytes)) as {
      userId?: unknown;
      nonce?: unknown;
      exp?: unknown;
    };
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.nonce !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < now
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      nonce: parsed.nonce,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

async function paypalDestinationForUser(userId: string) {
  const db = await getDb();
  const [profile] = await db
    .select({ paymentDestinationsJson: profiles.paymentDestinationsJson })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return (
    parsePaymentDestinationsJson(profile?.paymentDestinationsJson).find(
      (destination) => destination.rail === "paypal",
    )?.destination ?? null
  );
}

export async function getPayPalConnection(
  requestOrHeaders?: Request | Headers,
): Promise<PayPalConnection> {
  const available = await getPayPalConnectAvailability();
  if (!available) return publicPayPalConnection(false, false);
  try {
    const session = await getMarketplaceSession(requestOrHeaders);
    if (!session?.user.id) return publicPayPalConnection(true, false);
    const db = await getDb();
    const [paypal] = await db
      .select({ id: authAccounts.id })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, session.user.id),
          eq(authAccounts.providerId, "paypal"),
        ),
      )
      .limit(1);
    if (!paypal) return publicPayPalConnection(true, false);
    return publicPayPalConnection(
      true,
      true,
      await paypalDestinationForUser(session.user.id),
    );
  } catch {
    return publicPayPalConnection(true, false);
  }
}

export async function replacePaypalDestination(
  userId: string,
  displayName: string,
  paypal: PaymentDestination,
) {
  const db = await getDb();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const destinations = parsePaymentDestinationsJson(
    profile?.paymentDestinationsJson,
  ).filter((destination) => destination.rail !== "paypal");
  const brokers = parseShippingBrokersJson(profile?.paymentDestinationsJson);
  const paymentDestinationsJson = serializePaymentBundle(
    [paypal, ...destinations],
    brokers,
  );
  const updatedAt = new Date().toISOString();
  const nextDisplayName =
    profile?.displayName?.trim() || displayName.trim() || "Member";
  await db
    .insert(profiles)
    .values({
      id: userId,
      displayName: nextDisplayName,
      socialAccountsJson: profile?.socialAccountsJson ?? "[]",
      paymentDestinationsJson,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        paymentDestinationsJson,
        updatedAt,
      },
    });
}

export async function writePaypalPaymentDestination(
  userId: string,
  displayName: string,
  destination: string,
) {
  await replacePaypalDestination(
    userId,
    displayName,
    paypalOauthDestination(destination),
  );
}

export async function clearPaypalPaymentDestination(userId: string) {
  const db = await getDb();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!profile) return;
  const destinations = parsePaymentDestinationsJson(
    profile.paymentDestinationsJson,
  ).filter((destination) => destination.rail !== "paypal");
  const brokers = parseShippingBrokersJson(profile.paymentDestinationsJson);
  const paymentDestinationsJson = serializePaymentBundle(destinations, brokers);
  await db
    .update(profiles)
    .set({
      paymentDestinationsJson,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(profiles.id, userId));
}

export async function upsertPaypalAccount(input: {
  userId: string;
  payerId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scope: string | null;
}) {
  const db = await getDb();
  const now = Date.now();
  const expiresAt =
    input.expiresIn && Number.isFinite(input.expiresIn)
      ? new Date(now + input.expiresIn * 1000)
      : null;
  const [existing] = await db
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.userId, input.userId),
        eq(authAccounts.providerId, "paypal"),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(authAccounts)
      .set({
        accountId: input.payerId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        accessTokenExpiresAt: expiresAt,
        scope: input.scope,
        updatedAt: new Date(now),
      })
      .where(eq(authAccounts.id, existing.id));
    return;
  }
  await db.insert(authAccounts).values({
    id: crypto.randomUUID(),
    userId: input.userId,
    accountId: input.payerId,
    providerId: "paypal",
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    accessTokenExpiresAt: expiresAt,
    scope: input.scope,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
}

export async function deletePaypalAccount(userId: string) {
  const db = await getDb();
  await db
    .delete(authAccounts)
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "paypal")),
    );
}

export async function exchangePaypalAuthorizationCode(input: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  live: boolean;
}) {
  const basic = btoa(`${input.clientId}:${input.clientSecret}`);
  const tokenResponse = await fetch(`${paypalApiOrigin(input.live)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  if (!tokenResponse.ok) return null;
  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
    id_token?: unknown;
  };
  if (typeof tokenPayload.access_token !== "string" || !tokenPayload.access_token) {
    return null;
  }
  const userHeaders = {
    authorization: `Bearer ${tokenPayload.access_token}`,
    accept: "application/json",
  };
  let identity = mergePaypalIdentity();
  for (const userInfoUrl of paypalUserInfoUrls(input.live)) {
    const userResponse = await fetch(userInfoUrl, { headers: userHeaders });
    if (!userResponse.ok) continue;
    identity = mergePaypalIdentity(
      identity,
      parsePaypalIdentity(await userResponse.json()),
    );
    if (identity.payerId && (identity.email || identity.paypalMe)) break;
  }
  if (typeof tokenPayload.id_token === "string") {
    identity = mergePaypalIdentity(
      identity,
      parsePaypalIdToken(tokenPayload.id_token),
    );
  }
  if (!identity.payerId) return null;
  return {
    payerId: identity.payerId,
    email: identity.email,
    name: identity.name,
    paypalMe: identity.paypalMe,
    accessToken: tokenPayload.access_token,
    refreshToken:
      typeof tokenPayload.refresh_token === "string"
        ? tokenPayload.refresh_token
        : null,
    expiresIn:
      typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : null,
    scope: typeof tokenPayload.scope === "string" ? tokenPayload.scope : null,
  };
}

export async function readPaypalOAuthSecrets() {
  const env = await readPaypalEnv();
  const clientId = env.PAYPAL_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  const signingSecret =
    env.BETTER_AUTH_SECRET?.trim() || clientSecret;
  return {
    clientId,
    clientSecret,
    signingSecret,
    live: paypalUsesLiveEnv(env.PAYPAL_ENV),
  };
}

export function paypalOauthCookie(nonce: string, secure: boolean) {
  return `${PAYPAL_OAUTH_COOKIE}=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${
    secure ? "; Secure" : ""
  }`;
}

export function clearPaypalOauthCookie(secure: boolean) {
  return `${PAYPAL_OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    secure ? "; Secure" : ""
  }`;
}

export function createPaypalOAuthNonce() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export function paypalStateExpiry(now = Date.now()) {
  return now + STATE_TTL_MS;
}
