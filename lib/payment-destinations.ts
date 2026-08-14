import type { PaymentDestination, PaymentRail } from "./types";

type RailKind = "fiat" | "us_contact" | "bitcoin" | "evm";

type PaymentRailDefinition = {
  id: PaymentRail;
  label: string;
  hint: string;
  connectUrl: string;
  asset: PaymentDestination["asset"];
  networkId: string | null;
  networkLabel: string | null;
  kind: RailKind;
};

export const PAYMENT_RAILS: ReadonlyArray<PaymentRailDefinition> = [
  {
    id: "paypal",
    label: "PayPal",
    hint: "PayPal email or paypal.me / paypal.com link",
    connectUrl: "https://www.paypal.com",
    asset: null,
    networkId: null,
    networkLabel: null,
    kind: "fiat",
  },
  {
    id: "venmo",
    label: "Venmo",
    hint: "Venmo username or venmo.com link",
    connectUrl: "https://venmo.com",
    asset: null,
    networkId: null,
    networkLabel: null,
    kind: "fiat",
  },
  {
    id: "cashapp",
    label: "Cash App",
    hint: "Cashtag or cash.app link",
    connectUrl: "https://cash.app",
    asset: null,
    networkId: null,
    networkLabel: null,
    kind: "fiat",
  },
  {
    id: "zelle",
    label: "Zelle",
    hint: "Public Zelle email or U.S. mobile number. Type it yourself; this is not filled from your login.",
    connectUrl: "https://www.zellepay.com",
    asset: null,
    networkId: null,
    networkLabel: null,
    kind: "us_contact",
  },
  {
    id: "apple_cash",
    label: "Apple Cash",
    hint: "Public Apple Cash email or U.S. mobile number. Type it yourself; this is not filled from your login.",
    connectUrl: "https://www.apple.com/apple-cash/",
    asset: null,
    networkId: null,
    networkLabel: null,
    kind: "us_contact",
  },
  {
    id: "bitcoin_mainnet",
    label: "Bitcoin",
    hint: "Public Bitcoin Mainnet address only. Never paste a private key.",
    connectUrl: "https://bitcoin.org",
    asset: "BTC",
    networkId: "bitcoin_mainnet",
    networkLabel: "Bitcoin Mainnet",
    kind: "bitcoin",
  },
  {
    id: "ethereum_mainnet",
    label: "Ethereum",
    hint: "Public Ethereum Mainnet address (0x…). Never paste a private key.",
    connectUrl: "https://ethereum.org",
    asset: "ETH",
    networkId: "ethereum_mainnet",
    networkLabel: "Ethereum Mainnet",
    kind: "evm",
  },
  {
    id: "usdt_ethereum",
    label: "Tether (USDT)",
    hint: "Public USDT address on Ethereum Mainnet (ERC-20). Never paste a private key.",
    connectUrl: "https://tether.to",
    asset: "USDT",
    networkId: "usdt_ethereum",
    networkLabel: "Ethereum Mainnet (ERC-20)",
    kind: "evm",
  },
  {
    id: "bnb_bsc",
    label: "BNB",
    hint: "Public BNB address on BNB Smart Chain Mainnet. Never paste a private key.",
    connectUrl: "https://www.bnbchain.org",
    asset: "BNB",
    networkId: "bnb_bsc",
    networkLabel: "BNB Smart Chain Mainnet",
    kind: "evm",
  },
  {
    id: "usdc_ethereum",
    label: "USDC",
    hint: "Public USDC address on Ethereum Mainnet (ERC-20). Never paste a private key.",
    connectUrl: "https://www.circle.com/usdc",
    asset: "USDC",
    networkId: "usdc_ethereum",
    networkLabel: "Ethereum Mainnet (ERC-20)",
    kind: "evm",
  },
];

const RAIL_BY_ID = new Map(PAYMENT_RAILS.map((rail) => [rail.id, rail]));
const ALLOWED_RAILS = new Set<PaymentRail>(PAYMENT_RAILS.map((rail) => rail.id));

const LEGACY_SAFE_RAILS: Record<string, PaymentRail> = {
  bitcoin: "bitcoin_mainnet",
  ethereum: "ethereum_mainnet",
};

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
  if (!hostMatches(host, "paypal.com") && !hostMatches(host, "paypal.me")) {
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

function normalizeUsMobile(value: string): string | null {
  if (/[a-z]/i.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  let national = "";
  if (digits.length === 10) national = digits;
  else if (digits.length === 11 && digits.startsWith("1")) national = digits.slice(1);
  else return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null;
  return `+1${national}`;
}

function normalizeUsContact(value: string): string | null {
  if (/^(javascript|data|file|about|blob|mailto|tel):/i.test(value)) return null;
  if (EMAIL.test(value)) return value.toLowerCase();
  return normalizeUsMobile(value);
}

function resolveRailId(value: unknown): PaymentRail | null {
  if (typeof value !== "string") return null;
  if (ALLOWED_RAILS.has(value as PaymentRail)) return value as PaymentRail;
  return LEGACY_SAFE_RAILS[value] ?? null;
}

function toStoredDestination(
  rail: PaymentRailDefinition,
  destination: string,
): PaymentDestination {
  return {
    rail: rail.id,
    destination,
    asset: rail.asset,
    networkId: rail.networkId,
    networkLabel: rail.networkLabel,
  };
}

function normalizeDestination(rail: PaymentRailDefinition, raw: string): string | null {
  const value = raw.trim();
  if (!value || looksLikeSecret(value)) return null;
  if (/^(javascript|data|file|about|blob):/i.test(value)) return null;

  switch (rail.kind) {
    case "fiat":
      if (rail.id === "paypal") return normalizePayPal(value);
      if (rail.id === "venmo") return normalizeVenmo(value);
      if (rail.id === "cashapp") return normalizeCashApp(value);
      return null;
    case "us_contact":
      return normalizeUsContact(value);
    case "bitcoin":
      return normalizeBitcoin(value);
    case "evm":
      return normalizeEvm(value);
    default:
      return null;
  }
}

function networkMatches(rail: PaymentRailDefinition, entry: object) {
  const networkId = (entry as { networkId?: unknown }).networkId;
  if (networkId === undefined || networkId === null || networkId === "") {
    return true;
  }
  return networkId === rail.networkId;
}

export function parsePaymentDestinationsJson(
  value: string | null | undefined,
): PaymentDestination[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { destinations?: unknown }).destinations)
        ? (parsed as { destinations: unknown[] }).destinations
        : [];
    if (!Array.isArray(list)) return [];
    const byRail = new Map<PaymentRail, PaymentDestination>();
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const railId = resolveRailId((entry as { rail?: unknown }).rail);
      const destination = (entry as { destination?: unknown }).destination;
      if (!railId || typeof destination !== "string") continue;
      const rail = RAIL_BY_ID.get(railId);
      if (!rail || !networkMatches(rail, entry)) continue;
      const normalized = normalizeDestination(rail, destination);
      if (!normalized) continue;
      byRail.set(rail.id, toStoredDestination(rail, normalized));
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
    const railId = (entry as { rail?: unknown }).rail;
    if (typeof railId !== "string" || !ALLOWED_RAILS.has(railId as PaymentRail)) {
      return {
        ok: false,
        error: "Payment destinations are limited to the launch rails and networks.",
      };
    }
    const rail = RAIL_BY_ID.get(railId as PaymentRail);
    if (!rail || !networkMatches(rail, entry)) {
      return {
        ok: false,
        error: "Each crypto destination must use its explicit launch network.",
      };
    }
    const destination = (entry as { destination?: unknown }).destination;
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
    const normalized = normalizeDestination(rail, trimmed);
    if (!normalized) {
      return {
        ok: false,
        error: `That ${rail.label} destination is not a public identifier we can store.`,
      };
    }
    byRail.set(rail.id, toStoredDestination(rail, normalized));
  }

  return {
    ok: true,
    destinations: PAYMENT_RAILS.flatMap((rail) => {
      const saved = byRail.get(rail.id);
      return saved ? [saved] : [];
    }),
  };
}
