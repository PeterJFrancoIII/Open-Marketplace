export const SHIPPING_BROKERS = [
  {
    id: "pirate_ship",
    label: "Pirate Ship",
    href: "https://www.pirateship.com/ship",
    hint: "Official Pirate Ship calculator. There is no public third-party rate API.",
  },
  {
    id: "parcel_monkey",
    label: "Parcel Monkey",
    href: "https://www.parcelmonkey.com/shipping-calculator",
    hint: "Official Parcel Monkey calculator. Live GetQuote uses the preview server key, not this profile.",
  },
  {
    id: "usps",
    label: "USPS",
    href: "https://www.usps.com/ship/",
    hint: "Official USPS shipping. The marketplace does not buy postage.",
  },
  {
    id: "ups",
    label: "UPS",
    href: "https://www.ups.com/us/en/business-solutions/shipping",
    hint: "Official UPS shipping. The marketplace does not buy postage.",
  },
  {
    id: "fedex",
    label: "FedEx",
    href: "https://www.fedex.com/en-us/shipping.html",
    hint: "Official FedEx shipping. The marketplace does not buy postage.",
  },
  {
    id: "dhl",
    label: "DHL",
    href: "https://www.dhl.com/us-en/home/get-a-quote.html",
    hint: "Official DHL quotes. The marketplace does not book a shipment.",
  },
] as const;

export type ShippingBrokerId = (typeof SHIPPING_BROKERS)[number]["id"];

export type ShippingBrokerConnection = {
  id: ShippingBrokerId;
  account: string | null;
};

const BROKER_IDS = new Set<ShippingBrokerId>(
  SHIPPING_BROKERS.map((broker) => broker.id),
);

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function looksLikeSecret(value: string) {
  return (
    value.length > 80 ||
    /token|secret|apikey|private key|seed phrase/i.test(value)
  );
}

function normalizeAccount(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (looksLikeSecret(trimmed)) return null;
  if (EMAIL.test(trimmed)) return trimmed.toLowerCase();
  if (trimmed.length > 64) return null;
  if (/^(javascript|data|file|about|blob):/i.test(trimmed)) return null;
  return trimmed;
}

export function parseShippingBrokersJson(
  value: string | null | undefined,
): ShippingBrokerConnection[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return [];
    if (!parsed || typeof parsed !== "object") return [];
    return normalizeShippingBrokers(
      (parsed as { shippingBrokers?: unknown }).shippingBrokers,
    ).brokers;
  } catch {
    return [];
  }
}

export function normalizeShippingBrokers(input: unknown):
  | { ok: true; brokers: ShippingBrokerConnection[] }
  | { ok: false; error: string; brokers: ShippingBrokerConnection[] } {
  if (input == null) {
    return { ok: true, brokers: [] };
  }
  if (!Array.isArray(input)) {
    return {
      ok: false,
      error: "Shipping brokers must be a list.",
      brokers: [],
    };
  }
  if (input.length > SHIPPING_BROKERS.length) {
    return {
      ok: false,
      error: "Too many shipping brokers.",
      brokers: [],
    };
  }

  const byId = new Map<ShippingBrokerId, ShippingBrokerConnection>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      return {
        ok: false,
        error: "Each shipping broker must be an object.",
        brokers: [],
      };
    }
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== "string" || !BROKER_IDS.has(id as ShippingBrokerId)) {
      return {
        ok: false,
        error: "Shipping connectors are limited to the official broker list.",
        brokers: [],
      };
    }
    const account = normalizeAccount((entry as { account?: unknown }).account);
    if (
      typeof (entry as { account?: unknown }).account === "string" &&
      (entry as { account: string }).account.trim() &&
      account == null
    ) {
      return {
        ok: false,
        error: "That shipping account is not a public identifier we can store.",
        brokers: [],
      };
    }
    byId.set(id as ShippingBrokerId, {
      id: id as ShippingBrokerId,
      account,
    });
  }

  return {
    ok: true,
    brokers: SHIPPING_BROKERS.flatMap((broker) => {
      const saved = byId.get(broker.id);
      return saved ? [saved] : [];
    }),
  };
}

export function serializePaymentBundle(
  destinations: unknown[],
  shippingBrokers: ShippingBrokerConnection[],
) {
  if (!shippingBrokers.length) return JSON.stringify(destinations);
  return JSON.stringify({
    v: 2,
    destinations,
    shippingBrokers,
  });
}
