import { checkSocialAccounts } from "./social-health";
import type { SocialProof } from "./types";

const SOCIAL_PROVIDERS = ["facebook", "instagram", "tiktok"] as const;
type SupportedSocialProvider = (typeof SOCIAL_PROVIDERS)[number];

function isSupportedProvider(value: unknown): value is SupportedSocialProvider {
  return (
    value === "facebook" || value === "instagram" || value === "tiktok"
  );
}

function asSelfReported(account: SocialProof): SocialProof {
  return {
    ...account,
    metricsSource: "self-reported",
  };
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
      if (!isSupportedProvider(provider) || typeof url !== "string" || !url.trim()) {
        continue;
      }
      byProvider.set(provider, asSelfReported(entry as SocialProof));
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
  if (input.length > 3) {
    return { ok: false, error: "At most three social accounts can be saved." };
  }

  const byProvider = new Map<SupportedSocialProvider, SocialProof>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Each social account must be an object." };
    }
    const provider = (entry as { provider?: unknown }).provider;
    const url = (entry as { url?: unknown }).url;
    if (!isSupportedProvider(provider)) {
      return {
        ok: false,
        error: "Social links are limited to Facebook, Instagram, and TikTok.",
      };
    }
    if (typeof url !== "string") {
      return { ok: false, error: "Each social account needs a profile URL." };
    }
    if (!url.trim()) continue;
    byProvider.set(
      provider,
      asSelfReported({
        ...(entry as SocialProof),
        provider,
        url: url.trim(),
      }),
    );
  }

  const candidates = SOCIAL_PROVIDERS.flatMap((provider) => {
    const saved = byProvider.get(provider);
    return saved ? [saved] : [];
  });
  if (!candidates.length) return { ok: true, accounts: [] };

  const checked = (await checkSocialAccounts(candidates)).map(asSelfReported);
  const broken = checked.find(
    (account) => account.health === "dead" || account.health === "invalid",
  );
  if (broken) {
    return {
      ok: false,
      error: "Fix or remove the unavailable social profile before saving.",
      account: broken,
    };
  }
  return { ok: true, accounts: checked };
}
