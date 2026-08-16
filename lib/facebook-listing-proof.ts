import type { SocialProof } from "./types";

export const FACEBOOK_CONNECT_SCOPES = ["public_profile", "user_link"] as const;

const FACEBOOK_PROFILE_HOSTS = ["facebook.com", "fb.com"];
const BLOCKED_FACEBOOK_PATHS = new Set([
  "login",
  "share",
  "sharer.php",
  "dialog",
  "watch",
  "reel",
  "reels",
  "marketplace",
  "gaming",
  "adsmanager",
  "privacy",
  "help",
  "policies",
  "legal",
  "recover",
  "reg",
  "r.php",
]);

function hostMatches(hostname: string, suffix: string) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

export function publicFacebookProfileUrl(value?: string | null): string {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (url.username || url.password || url.port) return "";
    const host = url.hostname.toLowerCase();
    if (!FACEBOOK_PROFILE_HOSTS.some((allowed) => hostMatches(host, allowed))) {
      return "";
    }
    const first = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
    if (!first || BLOCKED_FACEBOOK_PATHS.has(first)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function isConnectedFacebookProof(account: SocialProof): boolean {
  return account.provider === "facebook" && account.metricsSource === "oauth";
}

export function connectedFacebookSocialProof(
  sellerName: string,
  profileUrl = "",
): SocialProof {
  const handle = sellerName.trim() || "Facebook";
  const url = publicFacebookProfileUrl(profileUrl);
  return {
    provider: "facebook",
    url,
    handle,
    metricsSource: "oauth",
    health: "active",
    healthMessage: "Connected with Facebook Login.",
    connectionLabel: "friends",
  };
}

export function mergeConnectedFacebookProof(
  accounts: SocialProof[],
  facebookConnected: boolean,
  sellerName: string,
): SocialProof[] {
  const others = accounts.filter((account) => account.provider !== "facebook");
  const typedFacebook = accounts.filter(
    (account) => account.provider === "facebook" && !isConnectedFacebookProof(account),
  );
  if (!facebookConnected) {
    return [...typedFacebook, ...others];
  }
  const oauthFacebook = accounts.find(isConnectedFacebookProof);
  return [
    connectedFacebookSocialProof(sellerName, oauthFacebook?.url ?? ""),
    ...others,
  ];
}

export function upsertConnectedFacebookAccount(
  accounts: SocialProof[],
  sellerName: string,
  profileUrl: string,
): SocialProof[] {
  const others = accounts.filter((account) => account.provider !== "facebook");
  return [connectedFacebookSocialProof(sellerName, profileUrl), ...others];
}

export function withoutConnectedFacebook(accounts: SocialProof[]): SocialProof[] {
  return accounts.filter((account) => !isConnectedFacebookProof(account));
}
