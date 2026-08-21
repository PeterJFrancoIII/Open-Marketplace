import type { PaymentDestination } from "./types";

export const PAYPAL_PAYER_ATTRIBUTE_SCOPE =
  "https://uri.paypal.com/services/paypalattributes";

export const PAYPAL_ME_SETUP_URL = "https://www.paypal.com/paypalme";

export const PAYPAL_CONNECT_SCOPES = ["openid"] as const;

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
    `${origin}/v1/identity/openidconnect/userinfo?schema=openid`,
    `${origin}/v1/identity/oauth2/userinfo?schema=paypalv1.1`,
  ] as const;
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
  if (!payload || typeof payload !== "object") return null;
  const record = payload as {
    payer_id?: unknown;
    user_id?: unknown;
    sub?: unknown;
    email?: unknown;
    name?: unknown;
    emails?: unknown;
  };
  const emails = Array.isArray(record.emails) ? record.emails : [];
  const primaryEmail = emails.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const email = (entry as { value?: unknown }).value;
    return typeof email === "string" && email.includes("@");
  }) as { value?: string } | undefined;
  const email =
    (typeof record.email === "string" && record.email.includes("@")
      ? record.email
      : primaryEmail?.value) ?? "";
  const payerId =
    (typeof record.payer_id === "string" && record.payer_id.trim()) ||
    (typeof record.user_id === "string" && record.user_id.trim()) ||
    (typeof record.sub === "string" && record.sub.trim()) ||
    "";
  if (!payerId) return null;
  return {
    payerId: payerId.replace(
      /^https:\/\/www\.paypal\.com\/webapps\/auth\/identity\/user\//,
      "",
    ),
    email: email.trim().toLowerCase(),
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : null,
    paypalMe: paypalMeFromUserInfo(payload),
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
