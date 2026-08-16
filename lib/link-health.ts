import type { PaymentDestination, SocialProof } from "./types";

export const LINK_HEALTH_TTL_MS = 24 * 60 * 60 * 1000;

const PAYMENT_LINK_HOSTS: Partial<Record<PaymentDestination["rail"], string[]>> = {
  paypal: ["paypal.com", "paypal.me"],
  venmo: ["venmo.com"],
  cashapp: ["cash.app"],
};

const deadPageMarkers = [
  "page isn't available",
  "page isn’t available",
  "content isn't available",
  "content isn’t available",
  "couldn't find this account",
  "couldn’t find this account",
  "this account doesn't exist",
  "this account doesn’t exist",
  "user not found",
  "page not found",
];

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function hostMatches(hostname: string, suffix: string) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

export function isLinkCheckFresh(
  lastCheckedAt: string | null | undefined,
  now = Date.now(),
) {
  if (!lastCheckedAt) return false;
  const checked = Date.parse(lastCheckedAt);
  return Number.isFinite(checked) && now - checked < LINK_HEALTH_TTL_MS;
}

export function listingLinksNeedCheck(
  listing: {
    socialProofs?: SocialProof[];
    paymentDestinations?: PaymentDestination[];
  },
  now = Date.now(),
) {
  const stamps = [
    ...(listing.socialProofs ?? []).map((account) => account.lastCheckedAt),
    ...(listing.paymentDestinations ?? []).map((destination) => destination.lastCheckedAt),
  ];
  if (!stamps.length) return false;
  return stamps.some((stamp) => !isLinkCheckFresh(stamp, now));
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

async function fetchAllowlistedPaymentLink(
  initialUrl: URL,
  allowedHosts: string[],
): Promise<Response> {
  let current = initialUrl;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "cache-control": "no-cache",
        },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!redirectStatuses.has(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    const next = new URL(location, current);
    const host = next.hostname.toLowerCase();
    if (
      next.protocol !== "https:" ||
      !allowedHosts.some((allowed) => hostMatches(host, allowed))
    ) {
      throw new Error("Link redirected outside the payment platform.");
    }
    current = next;
  }
  throw new Error("Link redirected too many times.");
}

async function readTextPrefix(response: Response, maximumBytes = 96_000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  try {
    while (total < maximumBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      result += decoder.decode(value, { stream: true });
      if (total >= maximumBytes) break;
    }
    return result.toLowerCase();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function checkPaymentDestination(
  destination: PaymentDestination,
): Promise<PaymentDestination> {
  const checkedAt = new Date().toISOString();
  if (destination.rail === "paypal" && destination.source === "oauth") {
    return {
      ...destination,
      source: "oauth",
      health: "active",
      lastCheckedAt: checkedAt,
      healthMessage: "Linked with PayPal Login.",
    };
  }

  const allowedHosts = PAYMENT_LINK_HOSTS[destination.rail];
  const looksLikeUrl = /^https:\/\//i.test(destination.destination);
  if (!allowedHosts || !looksLikeUrl) {
    return {
      ...destination,
      source: destination.source === "oauth" ? "oauth" : "self-reported",
      health: "active",
      lastCheckedAt: checkedAt,
      healthMessage: "Public identifier format is valid.",
    };
  }

  const url = httpsUrl(destination.destination);
  if (!url) {
    return {
      ...destination,
      health: "invalid",
      lastCheckedAt: checkedAt,
      healthMessage: "Use a complete HTTPS payment link.",
    };
  }
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((allowed) => hostMatches(host, allowed))) {
    return {
      ...destination,
      health: "invalid",
      lastCheckedAt: checkedAt,
      healthMessage: "The URL must match the selected payment platform.",
    };
  }

  try {
    const response = await fetchAllowlistedPaymentLink(url, allowedHosts);
    if (response.status === 404 || response.status === 410) {
      return {
        ...destination,
        destination: url.toString(),
        health: "dead",
        lastCheckedAt: checkedAt,
        healthMessage: "Link returned not found.",
      };
    }
    if ([401, 403, 429].includes(response.status)) {
      return {
        ...destination,
        destination: url.toString(),
        health: "unknown",
        lastCheckedAt: checkedAt,
        healthMessage: "The platform blocked an automated recheck.",
      };
    }
    if (response.status < 200 || response.status >= 400) {
      return {
        ...destination,
        destination: url.toString(),
        health: "unknown",
        lastCheckedAt: checkedAt,
        healthMessage: `Platform returned status ${response.status}.`,
      };
    }
    const bodyPrefix = await readTextPrefix(response);
    if (deadPageMarkers.some((marker) => bodyPrefix.includes(marker))) {
      return {
        ...destination,
        destination: url.toString(),
        health: "dead",
        lastCheckedAt: checkedAt,
        healthMessage: "Platform reports this link is unavailable.",
      };
    }
    return {
      ...destination,
      destination: url.toString(),
      health: "active",
      lastCheckedAt: checkedAt,
      healthMessage: "Link resolves.",
    };
  } catch {
    return {
      ...destination,
      destination: url.toString(),
      health: "unknown",
      lastCheckedAt: checkedAt,
      healthMessage: "The link could not be rechecked right now.",
    };
  }
}

