import { PAYMENT_RAILS } from "./payment-destinations";
import {
  paypalPayHref,
  type PaypalPaymentKind,
} from "./paypal-pay-link";
import type { PaymentDestination } from "./types";

export type PaymentLinkDetails = {
  amountCents?: number;
  currency?: string;
  itemName?: string;
  kind?: PaypalPaymentKind;
};

const USDT_ETHEREUM = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDC_ETHEREUM = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

export type PaymentLink = {
  rail: PaymentDestination["rail"];
  label: string;
  destination: string;
  href: string | null;
  actionLabel: string;
};

function railLabel(rail: PaymentDestination["rail"]) {
  return PAYMENT_RAILS.find((item) => item.id === rail)?.label ?? rail;
}

function paypalHref(destination: string, details?: PaymentLinkDetails) {
  if (
    details &&
    Number.isSafeInteger(details.amountCents) &&
    (details.amountCents ?? 0) > 0
  ) {
    return paypalPayHref({
      destination,
      amountCents: details.amountCents ?? 0,
      currency: details.currency,
      itemName: details.itemName,
      kind: details.kind ?? "goods_and_services",
    });
  }
  if (destination.includes("@")) {
    return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(destination)}`;
  }
  return destination;
}

function venmoHref(destination: string) {
  if (destination.startsWith("https://")) return destination;
  return `https://venmo.com/${encodeURIComponent(destination.replace(/^@/, ""))}`;
}

function cashAppHref(destination: string) {
  if (destination.startsWith("https://")) return destination;
  return `https://cash.app/${destination.startsWith("$") ? destination : `$${destination}`}`;
}

export function paymentLinkFor(
  destination: PaymentDestination,
  details?: PaymentLinkDetails,
): PaymentLink {
  const label = railLabel(destination.rail);
  const value = destination.destination;
  if (destination.rail === "paypal") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: paypalHref(value, details),
      actionLabel: "Pay with PayPal",
    };
  }
  if (destination.rail === "venmo") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: venmoHref(value),
      actionLabel: "Open Venmo",
    };
  }
  if (destination.rail === "cashapp") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: cashAppHref(value),
      actionLabel: "Open Cash App",
    };
  }
  if (destination.rail === "bitcoin_mainnet") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: `bitcoin:${value}`,
      actionLabel: "Open Bitcoin wallet",
    };
  }
  if (destination.rail === "ethereum_mainnet") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: `ethereum:${value}@1`,
      actionLabel: "Open Ethereum wallet",
    };
  }
  if (destination.rail === "usdt_ethereum") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: `ethereum:${USDT_ETHEREUM}@1/transfer?address=${value}`,
      actionLabel: "Open USDT wallet",
    };
  }
  if (destination.rail === "usdc_ethereum") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: `ethereum:${USDC_ETHEREUM}@1/transfer?address=${value}`,
      actionLabel: "Open USDC wallet",
    };
  }
  if (destination.rail === "bnb_bsc") {
    return {
      rail: destination.rail,
      label,
      destination: value,
      href: null,
      actionLabel: "Copy BNB address",
    };
  }
  return {
    rail: destination.rail,
    label,
    destination: value,
    href: null,
    actionLabel: `Copy ${label}`,
  };
}

export function paymentLinksFor(
  destinations: PaymentDestination[],
  details?: PaymentLinkDetails,
) {
  return destinations.map((destination) => paymentLinkFor(destination, details));
}
