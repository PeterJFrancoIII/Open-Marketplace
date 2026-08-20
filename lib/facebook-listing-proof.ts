import type { SocialProof } from "./types";

export const FACEBOOK_CONNECT_SCOPES = [
  "public_profile",
  "user_link",
  "user_hometown",
  "user_location",
] as const;

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

const SOCIAL_HANDLE = /^@?[A-Za-z0-9._]{2,64}$/;

export function expandSocialProfileInput(
  provider: "facebook" | "instagram" | "tiktok",
  value: string,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed) || /[\/]/.test(trimmed) || /\.(com|net|org)\b/i.test(trimmed)) {
    const candidate = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
    try {
      const url = new URL(candidate);
      if (provider === "facebook") {
        return publicFacebookProfileUrl(url.toString()) || url.toString();
      }
      return url.toString();
    } catch {
      return trimmed;
    }
  }

  if (!SOCIAL_HANDLE.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  if (provider === "tiktok") return `https://www.tiktok.com/@${handle}`;
  if (provider === "instagram") return `https://www.instagram.com/${handle}`;
  return `https://www.facebook.com/${handle}`;
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
    const queryId = url.searchParams.get("id")?.trim() ?? "";
    if (first === "profile.php" || (!first && queryId)) {
      if (!queryId || !/^[A-Za-z0-9.]+$/.test(queryId)) return "";
      url.hash = "";
      url.pathname = "/profile.php";
      url.search = `?id=${queryId}`;
      return url.toString();
    }
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
  official: {
    displayName?: string | null;
    hasOfficialImage?: boolean;
    hasBio?: boolean;
    hasLocation?: boolean;
    hasWebsite?: boolean;
    hasBanner?: boolean;
  } = {},
): SocialProof {
  const handle = sellerName.trim() || "Facebook";
  const url = publicFacebookProfileUrl(profileUrl);
  const displayName = official.displayName?.trim() || undefined;
  return {
    provider: "facebook",
    url,
    handle,
    displayName,
    hasOfficialImage: Boolean(official.hasOfficialImage),
    hasBio: Boolean(official.hasBio),
    hasLocation: Boolean(official.hasLocation),
    hasWebsite: Boolean(official.hasWebsite),
    hasBanner: Boolean(official.hasBanner),
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
  const others = accounts.filter(
    (account) =>
      account.provider !== "facebook" && account.metricsSource === "oauth",
  );
  if (!facebookConnected) {
    return others;
  }
  const oauthFacebook = accounts.find(isConnectedFacebookProof);
  return [
    connectedFacebookSocialProof(
      sellerName,
      publicFacebookProfileUrl(oauthFacebook?.url),
      {
        displayName: oauthFacebook?.displayName,
        hasOfficialImage: oauthFacebook?.hasOfficialImage,
        hasBio: oauthFacebook?.hasBio,
        hasLocation: oauthFacebook?.hasLocation,
        hasWebsite: oauthFacebook?.hasWebsite,
        hasBanner: oauthFacebook?.hasBanner,
      },
    ),
    ...others,
  ];
}

export function upsertConnectedFacebookAccount(
  accounts: SocialProof[],
  sellerName: string,
  profileUrl: string,
  official: {
    displayName?: string | null;
    hasOfficialImage?: boolean;
    hasBio?: boolean;
    hasLocation?: boolean;
    hasWebsite?: boolean;
    hasBanner?: boolean;
  } = {},
): SocialProof[] {
  const others = accounts.filter(
    (account) =>
      account.provider !== "facebook" && account.metricsSource === "oauth",
  );
  return [connectedFacebookSocialProof(sellerName, profileUrl, official), ...others];
}

export function withoutConnectedFacebook(accounts: SocialProof[]): SocialProof[] {
  return accounts.filter(
    (account) =>
      !isConnectedFacebookProof(account) && account.metricsSource === "oauth",
  );
}
