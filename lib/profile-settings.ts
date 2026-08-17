import {
  expandSocialProfileInput,
  isConnectedFacebookProof,
  publicFacebookProfileUrl,
} from "./facebook-listing-proof";
import type { SocialProof } from "./types";

export { expandSocialProfileInput };

const SOCIAL_PROVIDERS = ["facebook", "instagram", "tiktok"] as const;
type SupportedSocialProvider = (typeof SOCIAL_PROVIDERS)[number];

function isSupportedProvider(value: unknown): value is SupportedSocialProvider {
  return (
    value === "facebook" || value === "instagram" || value === "tiktok"
  );
}

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
    const byProvider = new Map<SupportedSocialProvider, SocialProof>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const provider = (entry as { provider?: unknown }).provider;
      const url = (entry as { url?: unknown }).url;
      if (!isSupportedProvider(provider) || typeof url !== "string") {
        continue;
      }
      if ((entry as SocialProof).metricsSource !== "oauth") continue;
      if (provider === "facebook") {
        byProvider.set(provider, {
          ...(entry as SocialProof),
          provider,
          url: publicFacebookProfileUrl(url) || "",
          metricsSource: "oauth",
        });
        continue;
      }
      if (!url.trim()) continue;
      byProvider.set(provider, {
        ...(entry as SocialProof),
        provider,
        url: url.trim(),
        metricsSource: "oauth",
      });
    }
    return SOCIAL_PROVIDERS.flatMap((provider) => {
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
  facebookConnected = false,
): SocialProof[] {
  void incoming;
  const existingOauth = connectedSocialAccounts(existing);
  if (facebookConnected) {
    const facebook = existingOauth.find(isConnectedFacebookProof);
    const others = existingOauth.filter((account) => account.provider !== "facebook");
    return facebook ? [facebook, ...others] : others;
  }
  return existingOauth.filter((account) => account.provider !== "facebook");
}
