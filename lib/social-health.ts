import type { SocialProof } from "./types";

type SupportedProvider = Exclude<SocialProof["provider"], "other">;

const providerRules: Record<
  SupportedProvider,
  { hosts: string[]; earliestDate: string; connectionLabel: "friends" | "followers" }
> = {
  facebook: {
    hosts: ["facebook.com", "fb.com"],
    earliestDate: "2004-02-04",
    connectionLabel: "friends",
  },
  instagram: {
    hosts: ["instagram.com"],
    earliestDate: "2010-10-06",
    connectionLabel: "followers",
  },
  tiktok: {
    hosts: ["tiktok.com"],
    earliestDate: "2016-09-01",
    connectionLabel: "followers",
  },
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

function providerForHost(hostname: string): SupportedProvider | null {
  for (const [provider, rule] of Object.entries(providerRules) as Array<
    [SupportedProvider, (typeof providerRules)[SupportedProvider]]
  >) {
    if (rule.hosts.some((host) => hostMatches(hostname, host))) return provider;
  }
  return null;
}

function normalizedProfileUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.port) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (!(url.hostname.includes("facebook") && url.pathname === "/profile.php" && key === "id")) {
        url.searchParams.delete(key);
      }
    }
    return url;
  } catch {
    return null;
  }
}

function profileHandle(url: URL, provider: SupportedProvider): string | null {
  if (provider === "facebook" && url.pathname === "/profile.php") {
    return url.searchParams.get("id");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  const handle = decodeURIComponent(segments.at(-1) ?? "").replace(/^@/, "").trim();
  if (!handle || ["login", "accounts", "explore", "home"].includes(handle.toLowerCase())) {
    return null;
  }
  return handle;
}

function validateMetadata(
  account: SocialProof,
  provider: SupportedProvider,
): string | null {
  if (!account.accountCreatedAt) return "Account creation date is required.";
  const createdAt = new Date(`${account.accountCreatedAt}T00:00:00Z`);
  const earliest = new Date(`${providerRules[provider].earliestDate}T00:00:00Z`);
  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt < earliest ||
    createdAt > new Date()
  ) {
    return `Enter a possible ${provider} account creation date.`;
  }
  if (
    !Number.isSafeInteger(account.connectionCount) ||
    (account.connectionCount ?? -1) < 0 ||
    (account.connectionCount ?? 0) > 2_000_000_000
  ) {
    return `Enter the current ${providerRules[provider].connectionLabel} count.`;
  }
  return null;
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

async function fetchAllowlistedProfile(initialUrl: URL): Promise<Response> {
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
    if (next.protocol !== "https:" || !providerForHost(next.hostname.toLowerCase())) {
      throw new Error("Profile redirected outside the supported social platform.");
    }
    current = next;
  }
  throw new Error("Profile redirected too many times.");
}

export async function checkSocialAccount(account: SocialProof): Promise<SocialProof> {
  const checkedAt = new Date().toISOString();
  const url = normalizedProfileUrl(account.url);
  if (!url) {
    return {
      ...account,
      health: "invalid",
      lastCheckedAt: checkedAt,
      healthMessage: "Use a complete HTTPS social profile URL.",
    };
  }

  const provider = providerForHost(url.hostname.toLowerCase());
  if (!provider || account.provider !== provider) {
    return {
      ...account,
      url: url.toString(),
      health: "invalid",
      lastCheckedAt: checkedAt,
      healthMessage: "The URL must match the selected social platform.",
    };
  }

  const handle = profileHandle(url, provider);
  if (!handle) {
    return {
      ...account,
      url: url.toString(),
      health: "invalid",
      lastCheckedAt: checkedAt,
      healthMessage: "Link directly to a user profile, not the platform homepage.",
    };
  }

  const metadataError = validateMetadata(account, provider);
  if (metadataError) {
    return {
      ...account,
      url: url.toString(),
      handle,
      connectionLabel: providerRules[provider].connectionLabel,
      health: "invalid",
      lastCheckedAt: checkedAt,
      healthMessage: metadataError,
    };
  }

  const normalized: SocialProof = {
    ...account,
    provider,
    url: url.toString(),
    handle,
    connectionLabel: providerRules[provider].connectionLabel,
    metricsSource: account.metricsSource === "oauth" ? "oauth" : "self-reported",
    lastCheckedAt: checkedAt,
  };

  try {
    const response = await fetchAllowlistedProfile(url);
    if (response.status === 404 || response.status === 410) {
      return { ...normalized, health: "dead", healthMessage: "Profile returned not found." };
    }
    if ([401, 403, 429].includes(response.status)) {
      return {
        ...normalized,
        health: "unknown",
        healthMessage: "The platform blocked an automated recheck.",
      };
    }
    if (response.status < 200 || response.status >= 400) {
      return {
        ...normalized,
        health: "unknown",
        healthMessage: `Platform returned status ${response.status}.`,
      };
    }

    const bodyPrefix = await readTextPrefix(response);
    if (deadPageMarkers.some((marker) => bodyPrefix.includes(marker))) {
      return { ...normalized, health: "dead", healthMessage: "Platform reports this profile is unavailable." };
    }
    return { ...normalized, health: "active", healthMessage: "Profile URL resolves." };
  } catch {
    return {
      ...normalized,
      health: "unknown",
      healthMessage: "The profile could not be rechecked right now.",
    };
  }
}

export async function checkSocialAccounts(accounts: SocialProof[]) {
  return Promise.all(accounts.slice(0, 3).map(checkSocialAccount));
}
