import { expandSocialProfileInput } from "./facebook-listing-proof";
import {
  isSocialConnectorId,
  publicSocialProfileUrl,
  SOCIAL_CONNECTOR_IDS,
  type SocialConnectorId,
} from "./social-connectors";
import type { SocialProof } from "./types";

export { expandSocialProfileInput };

export const SOCIAL_CONNECT_ONLY_ERROR =
  "Social profiles can only be added with Connect. Typed usernames and pasted links are not accepted.";

export function isConnectedSocialProof(account: SocialProof): boolean {
  return account.metricsSource === "oauth";
}

export function connectedSocialAccounts(accounts: SocialProof[]): SocialProof[] {
  return accounts.filter(isConnectedSocialProof);
}

export function parseSocialAccountsJson(
  value: string | null | undefined,
): SocialProof[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const byProvider = new Map<SocialConnectorId, SocialProof>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const provider = (entry as { provider?: unknown }).provider;
      const url = (entry as { url?: unknown }).url;
      if (!isSocialConnectorId(provider) || typeof url !== "string") {
        continue;
      }
      if ((entry as SocialProof).metricsSource !== "oauth") continue;
      byProvider.set(provider, {
        ...(entry as SocialProof),
        provider,
        url: publicSocialProfileUrl(provider, url),
        metricsSource: "oauth",
      });
    }
    return SOCIAL_CONNECTOR_IDS.flatMap((provider) => {
      const saved = byProvider.get(provider);
      return saved ? [saved] : [];
    });
  } catch {
    return [];
  }
}

export async function normalizeSocialAccountsForProfile(input: unknown): Promise<
  | { ok: true; accounts: SocialProof[] }
  | { ok: false; error: string; account?: SocialProof }
> {
  if (!Array.isArray(input)) {
    return { ok: false, error: "Social accounts must be a list." };
  }
  if (input.length > 0) {
    return { ok: false, error: SOCIAL_CONNECT_ONLY_ERROR };
  }
  return { ok: true, accounts: [] };
}

export function mergeSocialAccountsForSave(
  incoming: SocialProof[],
  existing: SocialProof[],
  connectedProviders: boolean | Iterable<string> = false,
): SocialProof[] {
  void incoming;
  const connected = new Set<SocialConnectorId>();
  if (connectedProviders === true) {
    connected.add("facebook");
  } else if (connectedProviders && typeof connectedProviders !== "boolean") {
    for (const provider of connectedProviders) {
      if (isSocialConnectorId(provider)) connected.add(provider);
    }
  }
  return connectedSocialAccounts(existing).filter(
    (account) =>
      isSocialConnectorId(account.provider) && connected.has(account.provider),
  );
}
