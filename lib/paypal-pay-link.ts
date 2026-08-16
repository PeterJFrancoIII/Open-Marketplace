export const PAYPAL_PAYMENT_KINDS = [
  "goods_and_services",
  "friends_and_family",
] as const;

export type PaypalPaymentKind = (typeof PAYPAL_PAYMENT_KINDS)[number];

const PAYPAL_ITEM_NAME_MAX = 127;
const PAYPAL_AMOUNT_MAX_CENTS = 1_000_000_000;

export function isPaypalPaymentKind(value: unknown): value is PaypalPaymentKind {
  return PAYPAL_PAYMENT_KINDS.includes(value as PaypalPaymentKind);
}

export function formatPaypalAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

export function paypalMeHandle(destination: string) {
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

function paypalEmail(destination: string) {
  const value = destination.trim();
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

function sanitizeItemName(value: string | undefined) {
  const item = (value ?? "Marketplace listing").replace(/\s+/g, " ").trim();
  return (item || "Marketplace listing").slice(0, PAYPAL_ITEM_NAME_MAX);
}

function sanitizeCurrency(value: string | undefined) {
  const currency = (value ?? "USD").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

export function paypalPayHref(input: {
  destination: string;
  amountCents: number;
  currency?: string;
  itemName?: string;
  kind?: PaypalPaymentKind;
}) {
  const destination = input.destination.trim();
  if (!destination) return null;
  if (
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents < 1 ||
    input.amountCents > PAYPAL_AMOUNT_MAX_CENTS
  ) {
    return null;
  }

  const amount = formatPaypalAmount(input.amountCents);
  const currency = sanitizeCurrency(input.currency);
  const kind = input.kind ?? "goods_and_services";
  const email = paypalEmail(destination);
  const handle = paypalMeHandle(destination);

  if (kind === "friends_and_family") {
    if (handle) {
      return `https://www.paypal.com/paypalme/${encodeURIComponent(handle)}/${amount}`;
    }
    if (email) {
      const url = new URL("https://www.paypal.com/myaccount/transfer/homepage/pay");
      url.searchParams.set("recipient", email);
      url.searchParams.set("amount", amount);
      url.searchParams.set("currencyCode", currency);
      return url.toString();
    }
    return null;
  }

  if (email) {
    const url = new URL("https://www.paypal.com/cgi-bin/webscr");
    url.searchParams.set("cmd", "_xclick");
    url.searchParams.set("business", email);
    url.searchParams.set("amount", amount);
    url.searchParams.set("currency_code", currency);
    url.searchParams.set("item_name", sanitizeItemName(input.itemName));
    url.searchParams.set("no_shipping", "1");
    return url.toString();
  }

  if (handle) {
    return `https://www.paypal.com/paypalme/${encodeURIComponent(handle)}/${amount}`;
  }
  return null;
}
