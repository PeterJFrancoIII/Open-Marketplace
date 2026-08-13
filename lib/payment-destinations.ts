import type { PaymentDestination, PaymentRail } from "./types";

export const PAYMENT_RAILS: ReadonlyArray<{
  id: PaymentRail;
  label: string;
  hint: string;
}> = [
  {
    id: "paypal",
    label: "PayPal",
    hint: "PayPal email or paypal.me / paypal.com link",
  },
  {
    id: "venmo",
    label: "Venmo",
    hint: "Venmo username or venmo.com link",
  },
  {
    id: "cashapp",
    label: "Cash App",
    hint: "Cashtag or cash.app link",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    hint: "Public Bitcoin address only. Never paste a private key.",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    hint: "Public Ethereum address (0x…). Never paste a private key.",
  },
  {
    id: "usdt",
    label: "Tether (USDT)",
    hint: "Public USDT wallet address. Never paste a private key.",
  },
  {
    id: "bnb",
    label: "BNB",
    hint: "Public BNB wallet address. Never paste a private key.",
  },
  {
    id: "solana",
    label: "Solana",
    hint: "Public Solana address. Never paste a private key.",
  },
];

const ALLOWED_RAILS = new Set<PaymentRail>(PAYMENT_RAILS.map((rail) => rail.id));

const EMAIL =
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const VENMO_USERNAME = /^@?[a-z0-9](?:[a-z0-9._-]{3,28}[a-z0-9])$/i;
const CASH_TAG = /^\$?[a-z][a-z0-9]{0,19}$/i;
const BTC_P2PKH = /^1[a-km-zA-HJ-NP-Z1-9]{24,33}$/;
const BTC_P2SH = /^3[a-km-zA-HJ-NP-Z1-9]{24,33}$/;
const BTC_BECH32 = /^bc1[ac-hj-np-z02-9]{11,71}$/;
const BTC_WIF = /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/;
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const EVM_PRIVATE_KEY = /^(?:0x)?[a-fA-F0-9]{64}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX64 = /^(?:0x)?[a-fA-F0-9]{64}$/;
const WORD_LIST = /^[a-z]+(?:\s+[a-z]+){11,23}$/i;

function hostMatches(hostname: string, suffix: string) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

function looksLikeSecret(value: string) {
  const trimmed = value.trim();
  if (BTC_WIF.test(trimmed) || HEX64.test(trimmed) || EVM_PRIVATE_KEY.test(trimmed)) {
    return true;
  }
  if (WORD_LIST.test(trimmed) && trimmed.split(/\s+/).length >= 12) {
    return true;
  }
  return /private\s*key|mnemonic|seed\s*phrase|secret\s*key/i.test(trimmed);
}

function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.port) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function normalizePayPal(value: string): string | null {
  if (EMAIL.test(value)) return value.toLowerCase();
  const url = httpsUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (
    !hostMatches(host, "paypal.com") &&
    !hostMatches(host, "paypal.me")
  ) {
    return null;
  }
  url.search = "";
  return url.toString();
}

function normalizeVenmo(value: string): string | null {
  if (VENMO_USERNAME.test(value) && !value.includes(".")) {
    const handle = value.replace(/^@/, "");
    return `@${handle}`;
  }
  const url = httpsUrl(value);
  if (!url) return null;
  if (!hostMatches(url.hostname.toLowerCase(), "venmo.com")) return null;
  url.search = "";
  return url.toString();
}

function normalizeCashApp(value: string): string | null {
  if (CASH_TAG.test(value)) {
    return `$${value.replace(/^\$/, "")}`;
  }
  const url = httpsUrl(value);
  if (!url) return null;
  if (!hostMatches(url.hostname.toLowerCase(), "cash.app")) return null;
  url.search = "";
  return url.toString();
}

function normalizeBitcoin(value: string): string | null {
  if (BTC_WIF.test(value) || HEX64.test(value)) return null;
  if (BTC_P2PKH.test(value) || BTC_P2SH.test(value) || BTC_BECH32.test(value)) {
    return value;
  }
  return null;
}

function normalizeEvm(value: string): string | null {
  if (EVM_PRIVATE_KEY.test(value) && !EVM_ADDRESS.test(value)) return null;
  if (!EVM_ADDRESS.test(value)) return null;
  return `0x${value.slice(-40).toLowerCase()}`;
}

function normalizeSolana(value: string): string | null {
  if (value.startsWith("0x") || HEX64.test(value) || BTC_WIF.test(value)) return null;
  if (!SOLANA_ADDRESS.test(value)) return null;
  return value;
}

function normalizeDestination(rail: PaymentRail, raw: string): string | null {
  const value = raw.trim();
  if (!value || looksLikeSecret(value)) return null;
  if (/^(javascript|data|file|about|blob):/i.test(value)) return null;

  switch (rail) {
    case "paypal":
      return normalizePayPal(value);
    case "venmo":
      return normalizeVenmo(value);
    case "cashapp":
      return normalizeCashApp(value);
    case "bitcoin":
      return normalizeBitcoin(value);
    case "ethereum":
    case "usdt":
    case "bnb":
      return normalizeEvm(value);
    case "solana":
      return normalizeSolana(value);
    default:
      return null;
  }
}

export function parsePaymentDestinationsJson(
  value: string | null | undefined,
): PaymentDestination[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const byRail = new Map<PaymentRail, PaymentDestination>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const rail = (entry as { rail?: unknown }).rail;
      const destination = (entry as { destination?: unknown }).destination;
      if (typeof rail !== "string" || typeof destination !== "string") continue;
      if (!ALLOWED_RAILS.has(rail as PaymentRail)) continue;
      const normalized = normalizeDestination(rail as PaymentRail, destination);
      if (!normalized) continue;
      byRail.set(rail as PaymentRail, {
        rail: rail as PaymentRail,
        destination: normalized,
      });
    }
    return PAYMENT_RAILS.flatMap((rail) => {
      const saved = byRail.get(rail.id);
      return saved ? [saved] : [];
    });
  } catch {
    return [];
  }
}

export function normalizePaymentDestinations(input: unknown):
  | { ok: true; destinations: PaymentDestination[] }
  | { ok: false; error: string } {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Payment destinations must be a list." };
  }
  if (input.length > PAYMENT_RAILS.length) {
    return { ok: false, error: "Too many payment destinations." };
  }

  const byRail = new Map<PaymentRail, PaymentDestination>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Each payment destination must be an object." };
    }
    const rail = (entry as { rail?: unknown }).rail;
    const destination = (entry as { destination?: unknown }).destination;
    if (typeof rail !== "string" || !ALLOWED_RAILS.has(rail as PaymentRail)) {
      return {
        ok: false,
        error: "Payment destinations are limited to the owner-specified options.",
      };
    }
    if (typeof destination !== "string") {
      return { ok: false, error: "Each payment destination needs a public identifier." };
    }
    const trimmed = destination.trim();
    if (!trimmed) continue;
    if (looksLikeSecret(trimmed)) {
      return {
        ok: false,
        error: "Private keys, seed phrases, and other secrets cannot be stored.",
      };
    }
    const normalized = normalizeDestination(rail as PaymentRail, trimmed);
    if (!normalized) {
      return {
        ok: false,
        error: `That ${rail} destination is not a public identifier we can store.`,
      };
    }
    byRail.set(rail as PaymentRail, {
      rail: rail as PaymentRail,
      destination: normalized,
    });
  }

  return {
    ok: true,
    destinations: PAYMENT_RAILS.flatMap((rail) => {
      const saved = byRail.get(rail.id);
      return saved ? [saved] : [];
    }),
  };
}
