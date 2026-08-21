import type { PayPalConnection, PaymentDestination } from "./types";

export const PAYPAL_PAYER_ATTRIBUTE_SCOPE =
  "https://uri.paypal.com/services/paypalattributes";

export const PAYPAL_ME_SETUP_URL = "https://www.paypal.com/paypalme";

export const PAYPAL_CONNECT_SCOPES = ["openid"] as const;

export function paypalFallbackAccountId(userId: string) {
  return `paypal-oauth:${userId}`;
}

export function paypalUsesLiveEnv(value?: string | null) {
  return value?.trim().toLowerCase() === "live";
}

export function paypalAuthorizeOrigin(live: boolean) {
  return live ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
}

export function paypalApiOrigin(live: boolean) {
  return live
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export function paypalAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  live: boolean;
}) {
  const query = [
    ["flowEntry", "static"],
    ["client_id", input.clientId],
    ["response_type", "code"],
    ["scope", PAYPAL_CONNECT_SCOPES.join(" ")],
    ["redirect_uri", input.redirectUri],
    ["state", input.state],
    ["fullPage", "true"],
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${paypalAuthorizeOrigin(input.live)}/connect?${query}`;
}

export function paypalUserInfoUrls(live: boolean) {
  const origin = paypalApiOrigin(live);
  return [
    `${origin}/v1/identity/openidconnect/userinfo`,
    `${origin}/v1/identity/openidconnect/userinfo?schema=openid`,
    `${origin}/v1/identity/oauth2/userinfo`,
    `${origin}/v1/identity/oauth2/userinfo?schema=paypalv1.1`,
  ] as const;
}

export type PaypalIdentity = {
  payerId: string | null;
  email: string;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  picture: string | null;
  accountType: string | null;
  verifiedAccount: boolean | null;
  emailVerified: boolean | null;
  locale: string | null;
  paypalMe: string | null;
};

function emptyPaypalIdentity(): PaypalIdentity {
  return {
    payerId: null,
    email: "",
    name: null,
    givenName: null,
    familyName: null,
    picture: null,
    accountType: null,
    verifiedAccount: null,
    emailVerified: null,
    locale: null,
    paypalMe: null,
  };
}

function firstPaypalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstPaypalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

export function emptyPayPalConnection(available = false): PayPalConnection {
  return {
    available,
    connected: false,
    email: null,
    paypalMe: null,
    name: null,
    givenName: null,
    familyName: null,
    imageUrl: null,
    accountType: null,
    verifiedAccount: null,
    locale: null,
  };
}

function firstPaypalEmail(record: Record<string, unknown>) {
  const candidates = [record.email, record.email_address, record.emailAddress];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate.trim().toLowerCase();
    }
  }
  if (!Array.isArray(record.emails)) return "";
  for (const entry of record.emails) {
    if (typeof entry === "string" && entry.includes("@")) {
      return entry.trim().toLowerCase();
    }
    if (!entry || typeof entry !== "object") continue;
    const email = entry as { value?: unknown; email?: unknown; address?: unknown };
    const value = email.value ?? email.email ?? email.address;
    if (typeof value === "string" && value.includes("@")) {
      return value.trim().toLowerCase();
    }
  }
  return "";
}

function firstPaypalPayerId(record: Record<string, unknown>) {
  const raw = record.payer_id ?? record.user_id ?? record.sub ?? record.payerId;
  const text =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw)
      : typeof raw === "string"
        ? raw.trim()
        : "";
  if (!text) return null;
  return text.replace(
    /^https:\/\/www\.paypal\.com\/webapps\/auth\/identity\/user\//,
    "",
  );
}

function firstPaypalName(record: Record<string, unknown>) {
  const explicit = firstPaypalText(record.name);
  if (explicit) return explicit;
  const given = firstPaypalText(record.given_name) ?? firstPaypalText(record.givenName);
  const family =
    firstPaypalText(record.family_name) ?? firstPaypalText(record.familyName);
  const combined = `${given ?? ""} ${family ?? ""}`.trim();
  return combined || null;
}

export function parsePaypalIdentity(payload: unknown): PaypalIdentity | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const givenName =
    firstPaypalText(record.given_name) ?? firstPaypalText(record.givenName);
  const familyName =
    firstPaypalText(record.family_name) ?? firstPaypalText(record.familyName);
  const identity: PaypalIdentity = {
    payerId: firstPaypalPayerId(record),
    email: firstPaypalEmail(record),
    name: firstPaypalName(record),
    givenName,
    familyName,
    picture:
      firstPaypalText(record.picture) ?? firstPaypalText(record.picture_url),
    accountType: firstPaypalText(record.account_type) ?? firstPaypalText(record.accountType),
    verifiedAccount:
      firstPaypalBoolean(record.verified_account) ??
      firstPaypalBoolean(record.verifiedAccount),
    emailVerified:
      firstPaypalBoolean(record.email_verified) ??
      firstPaypalBoolean(record.emailVerified),
    locale: firstPaypalText(record.locale),
    paypalMe: paypalMeFromUserInfo(payload),
  };
  if (
    !identity.payerId &&
    !identity.email &&
    !identity.name &&
    !identity.picture &&
    !identity.accountType &&
    !identity.paypalMe
  ) {
    return null;
  }
  return identity;
}

export function mergePaypalIdentity(
  ...parts: Array<PaypalIdentity | null | undefined>
): PaypalIdentity {
  const merged = emptyPaypalIdentity();
  for (const part of parts) {
    if (!part) continue;
    if (!merged.payerId && part.payerId) merged.payerId = part.payerId;
    if (!merged.email && part.email) merged.email = part.email;
    if (!merged.name && part.name) merged.name = part.name;
    if (!merged.givenName && part.givenName) merged.givenName = part.givenName;
    if (!merged.familyName && part.familyName) merged.familyName = part.familyName;
    if (!merged.picture && part.picture) merged.picture = part.picture;
    if (!merged.accountType && part.accountType) merged.accountType = part.accountType;
    if (merged.verifiedAccount == null && part.verifiedAccount != null) {
      merged.verifiedAccount = part.verifiedAccount;
    }
    if (merged.emailVerified == null && part.emailVerified != null) {
      merged.emailVerified = part.emailVerified;
    }
    if (!merged.locale && part.locale) merged.locale = part.locale;
    if (!merged.paypalMe && part.paypalMe) merged.paypalMe = part.paypalMe;
  }
  return merged;
}

export function serializePaypalStoredProfile(identity: PaypalIdentity) {
  return JSON.stringify({
    payer_id: identity.payerId,
    email: identity.email,
    name: identity.name,
    given_name: identity.givenName,
    family_name: identity.familyName,
    picture: identity.picture,
    account_type: identity.accountType,
    verified_account: identity.verifiedAccount,
    email_verified: identity.emailVerified,
    locale: identity.locale,
    paypalme: identity.paypalMe ? paypalMePublicUrl(identity.paypalMe) : undefined,
  });
}

export function parsePaypalStoredProfile(value?: string | null) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    try {
      return parsePaypalIdentity(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  return parsePaypalIdToken(trimmed);
}

export function paypalMePublicUrl(handle: string) {
  return `https://www.paypal.me/${handle.replace(/^@/, "").trim()}`;
}

function readPaypalMeHandle(destination: string) {
  const value = destination.trim();
  if (!value) return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    if (host === "paypal.me" || host === "www.paypal.me") {
      return parts[0] ?? null;
    }
    if (
      (host === "paypal.com" || host === "www.paypal.com") &&
      parts[0]?.toLowerCase() === "paypalme"
    ) {
      return parts[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function paypalMeFromUserInfo(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const values: unknown[] = Object.values(payload as Record<string, unknown>);
  for (const value of values) {
    const handle = paypalMeFromUnknown(value);
    if (handle) return handle;
  }
  return null;
}

function paypalMeFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    return readPaypalMeHandle(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const handle = paypalMeFromUnknown(entry);
      if (handle) return handle;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as { value?: unknown; url?: unknown; href?: unknown };
  return (
    paypalMeFromUnknown(record.value) ||
    paypalMeFromUnknown(record.url) ||
    paypalMeFromUnknown(record.href)
  );
}

export function parsePaypalIdToken(idToken: string) {
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return parsePaypalIdentity(JSON.parse(atob(`${padded}${pad}`)));
  } catch {
    return null;
  }
}

export function payerIdFromPaypalIdToken(idToken: string) {
  return parsePaypalIdToken(idToken)?.payerId ?? null;
}

export function paypalPublicPayTo(input: {
  email?: string | null;
  paypalMe?: string | null;
}) {
  const handle = input.paypalMe?.trim();
  if (handle) return paypalMePublicUrl(handle);
  const email = input.email?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

export function parsePaypalUserInfo(payload: unknown): {
  payerId: string;
  email: string;
  name: string | null;
  paypalMe: string | null;
} | null {
  const parsed = parsePaypalIdentity(payload);
  if (!parsed?.payerId) return null;
  return {
    payerId: parsed.payerId,
    email: parsed.email,
    name: parsed.name,
    paypalMe: parsed.paypalMe,
  };
}

export function overlayPaypalDestinations(
  destinations: PaymentDestination[],
  paypalConnected: boolean,
): PaymentDestination[] {
  const others = destinations.filter((destination) => destination.rail !== "paypal");
  const paypal = destinations.find((destination) => destination.rail === "paypal");
  if (!paypalConnected) {
    if (!paypal) return destinations;
    return [{ ...paypal, source: "self-reported" }, ...others];
  }
  if (!paypal) return destinations;
  return [
    {
      ...paypal,
      source: "oauth",
      health: paypal.health ?? "active",
      healthMessage: paypal.healthMessage ?? "Linked with PayPal Login.",
    },
    ...others,
  ];
}

export function paypalOauthDestination(destination: string): PaymentDestination {
  const handle = readPaypalMeHandle(destination);
  return {
    rail: "paypal",
    destination: handle ? paypalMePublicUrl(handle) : destination.trim().toLowerCase(),
    asset: null,
    networkId: null,
    networkLabel: null,
    source: "oauth",
    health: "active",
    healthMessage: "Linked with PayPal Login.",
  };
}

export function mergePaymentDestinationsForSave(
  incoming: PaymentDestination[],
  existing: PaymentDestination[],
  paypalConnected: boolean,
): PaymentDestination[] {
  const asSelfReported = (destination: PaymentDestination): PaymentDestination => ({
    ...destination,
    source: "self-reported",
  });
  const others = incoming
    .filter((destination) => destination.rail !== "paypal")
    .map(asSelfReported);
  if (paypalConnected) {
    const oauthPaypal =
      existing.find(
        (destination) =>
          destination.rail === "paypal" && destination.source === "oauth",
      ) ?? existing.find((destination) => destination.rail === "paypal");
    return oauthPaypal
      ? [{ ...oauthPaypal, source: "oauth" }, ...others]
      : others;
  }
  const typedPaypal = incoming
    .filter((destination) => destination.rail === "paypal")
    .map(asSelfReported);
  return [...typedPaypal, ...others];
}
