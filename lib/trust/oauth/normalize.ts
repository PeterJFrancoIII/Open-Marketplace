import type { SocialConnection, SocialProvider } from "../types.ts";
import type { ProviderPublicClaims } from "./types.ts";

/**
 * Merge provider claims into a social connection without inventing fields.
 * Self-reported values stay labeled self_reported; never upgrade them to provider
 * unless the adapter supplied the value.
 */
export function applyProviderClaimsToConnection(
  connection: SocialConnection,
  claims: ProviderPublicClaims,
  now = new Date(),
): SocialConnection {
  const fetchedAt = claims.fetchedAt || now.toISOString();
  const next: SocialConnection = {
    ...connection,
    providerSubjectHash: connection.providerSubjectHash,
    canonicalUrl: claims.canonicalUrl || connection.canonicalUrl,
    status: "oauth_verified",
    verifiedAt: fetchedAt,
    lastSuccessfulRefreshAt: fetchedAt,
    updatedAt: fetchedAt,
    scopesJson: JSON.stringify(claims.grantedScopes),
  };

  if (claims.handle !== undefined) {
    next.handle = claims.handle;
  }

  if (claims.accountCreatedAt !== undefined) {
    next.accountCreatedAt = claims.accountCreatedAt;
    next.accountCreatedAtSource = "provider";
  } else if (connection.accountCreatedAtSource === "provider") {
    // Provider no longer supplies it — clear provider-sourced value rather than lie.
    next.accountCreatedAt = undefined;
    next.accountCreatedAtSource = undefined;
  }
  // else keep prior self_reported as-is

  if (claims.connectionCount !== undefined) {
    next.connectionCount = claims.connectionCount;
    next.connectionCountSource = "provider";
    next.connectionLabel = claims.connectionLabel ?? connection.connectionLabel;
  } else if (connection.connectionCountSource === "provider") {
    next.connectionCount = undefined;
    next.connectionCountSource = undefined;
  }

  return next;
}

/** Build a public SocialProof-shaped claim set with honest source labels. */
export function publicProofFromConnection(
  connection: SocialConnection,
  provider: SocialProvider = connection.provider,
): {
  provider: SocialProvider;
  url: string;
  handle?: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  connectionLabel?: "friends" | "followers";
  metricsSource: "oauth" | "self-reported";
  health: "active" | "unknown" | "dead" | "invalid" | "checking";
  lastCheckedAt?: string;
} {
  const oauth = connection.status === "oauth_verified";
  return {
    provider,
    url: connection.canonicalUrl,
    handle: connection.handle,
    accountCreatedAt: connection.accountCreatedAt,
    connectionCount: connection.connectionCount,
    connectionLabel: connection.connectionLabel,
    metricsSource: oauth ? "oauth" : "self-reported",
    health:
      connection.status === "dead" || connection.status === "invalid"
        ? connection.status
        : connection.status === "oauth_verified" || connection.status === "live"
          ? "active"
          : "unknown",
    lastCheckedAt: connection.lastCheckedAt ?? connection.lastSuccessfulRefreshAt,
  };
}

export function nextRefreshBackoffSeconds(current: number): number {
  if (current <= 0) return 60;
  return Math.min(current * 2, 86_400);
}

export function claimsOmitUnsupported(input: {
  providerSubject: string;
  canonicalUrl?: string;
  handle?: string | null;
  accountCreatedAt?: string | null;
  connectionCount?: number | null;
  connectionLabel?: "friends" | "followers";
  grantedScopes: string[];
  fetchedAt: string;
}): ProviderPublicClaims {
  const omitted: ProviderPublicClaims["omittedFields"] = [];
  if (!input.canonicalUrl) omitted.push("canonicalUrl");
  if (input.handle == null || input.handle === "") omitted.push("handle");
  if (input.accountCreatedAt == null || input.accountCreatedAt === "") {
    omitted.push("accountCreatedAt");
  }
  if (input.connectionCount == null || !Number.isFinite(input.connectionCount)) {
    omitted.push("connectionCount");
  }

  return {
    providerSubject: input.providerSubject,
    canonicalUrl: input.canonicalUrl ?? "",
    handle: omitted.includes("handle") ? undefined : (input.handle ?? undefined),
    accountCreatedAt: omitted.includes("accountCreatedAt")
      ? undefined
      : (input.accountCreatedAt ?? undefined),
    connectionCount: omitted.includes("connectionCount")
      ? undefined
      : (input.connectionCount ?? undefined),
    connectionLabel: omitted.includes("connectionCount")
      ? undefined
      : input.connectionLabel,
    grantedScopes: input.grantedScopes,
    fetchedAt: input.fetchedAt,
    omittedFields: omitted,
  };
}
