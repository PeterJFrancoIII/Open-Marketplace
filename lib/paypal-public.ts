import type { PaymentDestination } from "./types";

export const PAYPAL_CONNECT_SCOPES = ["openid", "email", "profile"] as const;

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
  const url = new URL("/connect", paypalAuthorizeOrigin(input.live));
  url.searchParams.set("flowEntry", "static");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PAYPAL_CONNECT_SCOPES.join(" "));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function parsePaypalUserInfo(payload: unknown): {
  payerId: string;
  email: string;
  name: string | null;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as {
    payer_id?: unknown;
    user_id?: unknown;
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
    "";
  if (!email.trim() || !payerId) return null;
  return {
    payerId: payerId.replace(
      /^https:\/\/www\.paypal\.com\/webapps\/auth\/identity\/user\//,
      "",
    ),
    email: email.trim().toLowerCase(),
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : null,
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

export function paypalOauthDestination(email: string): PaymentDestination {
  return {
    rail: "paypal",
    destination: email.trim().toLowerCase(),
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
