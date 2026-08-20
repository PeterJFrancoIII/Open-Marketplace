import type { SocialProof } from "./types";

// Official Connect order: most to least important for seller proof.
export const SOCIAL_CONNECTOR_IDS = [
  "facebook",
  "tiktok",
  "instagram",
  "twitter",
  "linkedin",
  "reddit",
  "discord",
] as const;

export const TIKTOK_CONNECT_SCOPES = [
  "user.info.basic",
  "user.info.profile",
  "user.info.stats",
] as const;

export const TIKTOK_USER_INFO_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "avatar_url_100",
  "avatar_large_url",
  "display_name",
  "username",
  "profile_deep_link",
  "bio_description",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
  "is_verified",
].join(",");

export const TIKTOK_PUBLIC_LISTING_PROOF_ENABLED = true;
export const TIKTOK_SOCIAL_CREDIT_ENABLED = true;

export const INSTAGRAM_CONNECT_SCOPES = ["instagram_business_basic"] as const;

export type SocialConnectorId = (typeof SOCIAL_CONNECTOR_IDS)[number];

export type SocialConnector = {
  id: SocialConnectorId;
  label: string;
  envId: string;
  envSecret: string;
  envKey?: string;
  scopes: readonly string[];
  connectionLabel: SocialProof["connectionLabel"];
  hosts: readonly string[];
};

export const SOCIAL_CONNECTORS: readonly SocialConnector[] = [
  {
    id: "facebook",
    label: "Facebook",
    envId: "FACEBOOK_CLIENT_ID",
    envSecret: "FACEBOOK_CLIENT_SECRET",
    scopes: ["public_profile", "user_link", "user_hometown", "user_location"],
    connectionLabel: "friends",
    hosts: ["facebook.com", "fb.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    envId: "TIKTOK_CLIENT_KEY",
    envSecret: "TIKTOK_CLIENT_SECRET",
    envKey: "TIKTOK_CLIENT_KEY",
    scopes: TIKTOK_CONNECT_SCOPES,
    connectionLabel: "followers",
    hosts: ["tiktok.com"],
  },
  {
    id: "instagram",
    label: "Instagram",
    envId: "INSTAGRAM_CLIENT_ID",
    envSecret: "INSTAGRAM_CLIENT_SECRET",
    scopes: INSTAGRAM_CONNECT_SCOPES,
    connectionLabel: "followers",
    hosts: ["instagram.com"],
  },
  {
    id: "twitter",
    label: "X",
    envId: "TWITTER_CLIENT_ID",
    envSecret: "TWITTER_CLIENT_SECRET",
    scopes: ["users.read", "tweet.read", "offline.access"],
    connectionLabel: "followers",
    hosts: ["x.com", "twitter.com"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    envId: "LINKEDIN_CLIENT_ID",
    envSecret: "LINKEDIN_CLIENT_SECRET",
    scopes: ["openid", "profile"],
    connectionLabel: "connections",
    hosts: ["linkedin.com"],
  },
  {
    id: "reddit",
    label: "Reddit",
    envId: "REDDIT_CLIENT_ID",
    envSecret: "REDDIT_CLIENT_SECRET",
    scopes: ["identity"],
    connectionLabel: "followers",
    hosts: ["reddit.com"],
  },
  {
    id: "discord",
    label: "Discord",
    envId: "DISCORD_CLIENT_ID",
    envSecret: "DISCORD_CLIENT_SECRET",
    scopes: ["identify"],
    connectionLabel: "connections",
    hosts: ["discord.com"],
  },
];

export type OfficialSocialProfile = {
  provider: SocialConnectorId;
  providerAccountId: string;
  name?: string;
  handle?: string;
  imageUrl?: string;
  profileUrl?: string;
  bio?: string;
  location?: string;
  websiteUrl?: string;
  bannerUrl?: string;
  locale?: string;
  accountType?: string;
  accountCreatedAt?: string;
  connectionCount?: number;
  followingCount?: number;
  likesCount?: number;
  contentCount?: number;
  listedCount?: number;
  providerVerified?: boolean;
};

export type SocialConnection = {
  id: SocialConnectorId;
  label: string;
  available: boolean;
  connected: boolean;
  needsReconnect: boolean;
  name: string | null;
  handle: string | null;
  imageUrl: string | null;
  profileUrl: string | null;
  bio: string | null;
  location: string | null;
  websiteUrl: string | null;
  bannerUrl: string | null;
  locale: string | null;
  accountType: string | null;
  accountCreatedAt: string | null;
  connectionCount: number | null;
  followingCount: number | null;
  likesCount: number | null;
  contentCount: number | null;
  listedCount: number | null;
  providerVerified: boolean;
  connectionLabel: SocialProof["connectionLabel"];
};

export function isPublicListingSocialProofProvider(provider: SocialConnectorId) {
  return provider !== "tiktok" || TIKTOK_PUBLIC_LISTING_PROOF_ENABLED;
}

export function isSocialCreditProvider(provider: SocialConnectorId) {
  return provider !== "tiktok" || TIKTOK_SOCIAL_CREDIT_ENABLED;
}

export function isSocialConnectorId(value: unknown): value is SocialConnectorId {
  return (
    typeof value === "string" &&
    (SOCIAL_CONNECTOR_IDS as readonly string[]).includes(value)
  );
}

export function socialConnectorById(id: string): SocialConnector | undefined {
  return SOCIAL_CONNECTORS.find((connector) => connector.id === id);
}

function hostMatches(hostname: string, suffix: string) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

export function publicSocialProfileUrl(
  provider: SocialConnectorId,
  value?: string | null,
): string {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    if (url.username || url.password || url.port) return "";
    const connector = socialConnectorById(provider);
    if (!connector) return "";
    const host = url.hostname.toLowerCase();
    if (!connector.hosts.some((allowed) => hostMatches(host, allowed))) {
      return "";
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function connectedSocialProof(
  profile: OfficialSocialProfile,
  fallbackName = "",
): SocialProof {
  const connector = socialConnectorById(profile.provider);
  const handle =
    profile.handle?.trim() ||
    profile.name?.trim() ||
    fallbackName.trim() ||
    connector?.label ||
    profile.provider;
  const imageUrl = profile.imageUrl?.trim() || undefined;
  const bio = profile.bio?.trim() || undefined;
  const location = profile.location?.trim() || undefined;
  const websiteUrl = profile.websiteUrl?.trim() || undefined;
  const bannerUrl = profile.bannerUrl?.trim() || undefined;
  const locale = profile.locale?.trim() || undefined;
  const accountType = profile.accountType?.trim() || undefined;
  return {
    provider: profile.provider,
    url: publicSocialProfileUrl(profile.provider, profile.profileUrl),
    handle,
    displayName: profile.name?.trim() || undefined,
    accountCreatedAt: profile.accountCreatedAt,
    connectionCount: Number.isFinite(profile.connectionCount)
      ? profile.connectionCount
      : undefined,
    followingCount: Number.isFinite(profile.followingCount)
      ? profile.followingCount
      : undefined,
    likesCount: Number.isFinite(profile.likesCount) ? profile.likesCount : undefined,
    contentCount: Number.isFinite(profile.contentCount)
      ? profile.contentCount
      : undefined,
    imageUrl,
    bio,
    location,
    websiteUrl,
    bannerUrl,
    locale,
    accountType,
    hasOfficialImage: Boolean(imageUrl),
    hasBio: Boolean(bio),
    hasLocation: Boolean(location),
    hasWebsite: Boolean(websiteUrl),
    hasBanner: Boolean(bannerUrl),
    hasAccountType: Boolean(accountType),
    hasProviderBadge: profile.providerVerified === true,
    listedCount: Number.isFinite(profile.listedCount) ? profile.listedCount : undefined,
    connectionLabel: connector?.connectionLabel,
    metricsSource: "oauth",
    health: "active",
    healthMessage: `Connected with ${connector?.label ?? profile.provider}.`,
  };
}

export function upsertConnectedSocialAccount(
  accounts: SocialProof[],
  profile: OfficialSocialProfile,
  fallbackName = "",
): SocialProof[] {
  const others = accounts.filter(
    (account) =>
      account.provider !== profile.provider && account.metricsSource === "oauth",
  );
  return [connectedSocialProof(profile, fallbackName), ...others];
}

export function withoutConnectedProvider(
  accounts: SocialProof[],
  provider: SocialConnectorId,
): SocialProof[] {
  return accounts.filter(
    (account) =>
      account.metricsSource === "oauth" && account.provider !== provider,
  );
}

export function mergeConnectedSocialProofs(
  accounts: SocialProof[],
  connectedProviders: Iterable<string>,
  sellerName: string,
): SocialProof[] {
  const connected = new Set(
    [...connectedProviders].filter(isSocialConnectorId),
  );
  const byProvider = new Map<SocialConnectorId, SocialProof>();
  for (const account of accounts) {
    if (account.metricsSource !== "oauth" || !isSocialConnectorId(account.provider)) {
      continue;
    }
    if (!isPublicListingSocialProofProvider(account.provider)) continue;
    if (!connected.has(account.provider)) continue;
    byProvider.set(account.provider, {
      ...account,
      url: publicSocialProfileUrl(account.provider, account.url),
      metricsSource: "oauth",
      health: "active",
    });
  }
  for (const provider of connected) {
    if (!isPublicListingSocialProofProvider(provider)) continue;
    if (byProvider.has(provider)) continue;
    byProvider.set(
      provider,
      connectedSocialProof({ provider, providerAccountId: "" }, sellerName),
    );
  }
  return SOCIAL_CONNECTOR_IDS.flatMap((provider) => {
    const saved = byProvider.get(provider);
    return saved ? [saved] : [];
  });
}

export function socialAvailabilityFromEnv(
  env: Record<string, string | undefined>,
): Record<SocialConnectorId, boolean> {
  return Object.fromEntries(
    SOCIAL_CONNECTORS.map((connector) => {
      const id = env[connector.envKey ?? connector.envId]?.trim();
      const secret = env[connector.envSecret]?.trim();
      return [connector.id, Boolean(id && secret)];
    }),
  ) as Record<SocialConnectorId, boolean>;
}

export function connectedSocialCreditInput(accounts: SocialProof[]) {
  return accounts
    .filter(
      (account) =>
        account.metricsSource === "oauth" &&
        isSocialConnectorId(account.provider) &&
        isSocialCreditProvider(account.provider),
    )
    .map((account) => ({
      provider: account.provider,
      hasProfileUrl: Boolean(
        publicSocialProfileUrl(account.provider as SocialConnectorId, account.url),
      ),
      hasHandle: Boolean(account.handle?.trim()),
      hasDisplayName: Boolean(account.displayName?.trim()),
      hasAccountCreatedAt: Boolean(account.accountCreatedAt),
      hasConnectionCount: Number.isFinite(account.connectionCount),
      hasImage: Boolean(account.hasOfficialImage),
      hasBio: Boolean(account.hasBio),
      hasFollowingCount: Number.isFinite(account.followingCount),
      hasLikesCount: Number.isFinite(account.likesCount),
      hasContentCount: Number.isFinite(account.contentCount),
      hasLocation: Boolean(account.hasLocation),
      hasWebsite: Boolean(account.hasWebsite),
      hasBanner: Boolean(account.hasBanner),
      hasAccountType: Boolean(account.hasAccountType),
      hasProviderBadge: Boolean(account.hasProviderBadge),
    }));
}

function isoDateFromUnixSeconds(value: unknown): string | undefined {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function isoDateFromIso(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function isoDateFromDiscordSnowflake(id: string): string | undefined {
  if (!/^\d{5,22}$/.test(id)) return undefined;
  try {
    const created = Number((BigInt(id) >> 22n) + 1420070400000n);
    const date = new Date(created);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  } catch {
    return undefined;
  }
}

function finiteCount(value: unknown): number | undefined {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count < 0) return undefined;
  return Math.floor(count);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function readOfficialSocialProfile(
  provider: SocialConnectorId,
  accessToken: string,
): Promise<OfficialSocialProfile | null> {
  if (!accessToken.trim()) return null;
  if (provider === "facebook") return null;
  if (provider === "instagram") {
    const body = await officialJsonTrying(
      accessToken,
      [
        "id,user_id,username,account_type,name,profile_picture_url,followers_count,follows_count,media_count,biography,website",
        "id,username,account_type,name,profile_picture_url,followers_count,follows_count,media_count",
        "id,username,account_type,name",
      ],
      (fields) => {
        const url = new URL("https://graph.instagram.com/me");
        url.searchParams.set("fields", fields);
        return url;
      },
      (body) => typeof body.id === "string" && typeof body.username === "string",
    );
    const id = typeof body.id === "string" ? body.id : "";
    const username = typeof body.username === "string" ? body.username : "";
    if (!id || !username) return null;
    return {
      provider,
      providerAccountId: id,
      name: optionalText(body.name) || username,
      handle: username,
      imageUrl: optionalText(body.profile_picture_url),
      profileUrl: `https://www.instagram.com/${username}`,
      bio: optionalText(body.biography),
      websiteUrl: optionalText(body.website),
      accountType: optionalText(body.account_type),
      connectionCount: finiteCount(body.followers_count),
      followingCount: finiteCount(body.follows_count),
      contentCount: finiteCount(body.media_count),
    };
  }
  if (provider === "tiktok") {
    const url = new URL("https://open.tiktokapis.com/v2/user/info/");
    url.searchParams.set("fields", TIKTOK_USER_INFO_FIELDS);
    const body = await officialJson(url, accessToken);
    const user = (body.data as { user?: Record<string, unknown> } | undefined)?.user;
    const id = typeof user?.open_id === "string" ? user.open_id : "";
    if (!id) return null;
    const username = typeof user.username === "string" ? user.username.trim() : "";
    const avatar =
      typeof user.avatar_large_url === "string"
        ? user.avatar_large_url
        : typeof user.avatar_url_100 === "string"
          ? user.avatar_url_100
          : typeof user.avatar_url === "string"
            ? user.avatar_url
            : undefined;
    const bio =
      typeof user.bio_description === "string" ? user.bio_description.trim() : "";
    return {
      provider,
      providerAccountId: id,
      name:
        typeof user.display_name === "string" && user.display_name.trim()
          ? user.display_name
          : username || undefined,
      handle: username || undefined,
      imageUrl: avatar,
      profileUrl:
        typeof user.profile_deep_link === "string" && user.profile_deep_link
          ? user.profile_deep_link
          : username
            ? `https://www.tiktok.com/@${username}`
            : undefined,
      bio: bio || undefined,
      connectionCount: finiteCount(user.follower_count),
      followingCount: finiteCount(user.following_count),
      likesCount: finiteCount(user.likes_count),
      contentCount: finiteCount(user.video_count),
      providerVerified: user.is_verified === true,
    };
  }
  if (provider === "twitter") {
    const url = new URL("https://api.twitter.com/2/users/me");
    url.searchParams.set(
      "user.fields",
      "created_at,description,location,name,profile_banner_url,profile_image_url,public_metrics,url,username,verified,verified_type",
    );
    const body = await officialJson(url, accessToken);
    const user = body.data as Record<string, unknown> | undefined;
    const id = typeof user?.id === "string" ? user.id : "";
    const username = typeof user?.username === "string" ? user.username : "";
    if (!id || !username) return null;
    const metrics = user.public_metrics as {
      followers_count?: unknown;
      following_count?: unknown;
      tweet_count?: unknown;
      listed_count?: unknown;
    } | undefined;
    return {
      provider,
      providerAccountId: id,
      name: optionalText(user.name) || username,
      handle: username,
      imageUrl: optionalText(user.profile_image_url),
      profileUrl: `https://x.com/${username}`,
      bio: optionalText(user.description),
      location: optionalText(user.location),
      websiteUrl: optionalText(user.url),
      bannerUrl: optionalText(user.profile_banner_url),
      accountCreatedAt: isoDateFromIso(user.created_at),
      connectionCount: finiteCount(metrics?.followers_count),
      followingCount: finiteCount(metrics?.following_count),
      contentCount: finiteCount(metrics?.tweet_count),
      listedCount: finiteCount(metrics?.listed_count),
      providerVerified: user.verified === true,
    };
  }
  if (provider === "linkedin") {
    const body = await officialJson(
      new URL("https://api.linkedin.com/v2/userinfo"),
      accessToken,
    );
    const id = typeof body.sub === "string" ? body.sub : "";
    if (!id) return null;
    const given = typeof body.given_name === "string" ? body.given_name.trim() : "";
    const family = typeof body.family_name === "string" ? body.family_name.trim() : "";
    return {
      provider,
      providerAccountId: id,
      name:
        optionalText(body.name) ||
        [given, family].filter(Boolean).join(" ") ||
        undefined,
      imageUrl: optionalText(body.picture),
      locale: optionalText(body.locale),
    };
  }
  if (provider === "reddit") {
    const body = await officialJson(
      new URL("https://oauth.reddit.com/api/v1/me"),
      accessToken,
      { "User-Agent": "OpenMarketplace/0.1" },
    );
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name : "";
    if (!id || !name) return null;
    const subreddit =
      body.subreddit && typeof body.subreddit === "object"
        ? (body.subreddit as Record<string, unknown>)
        : undefined;
    return {
      provider,
      providerAccountId: id,
      name,
      handle: name,
      imageUrl: optionalText(body.icon_img) || optionalText(body.snoovatar_img),
      profileUrl: `https://www.reddit.com/user/${name}`,
      bio: optionalText(subreddit?.public_description),
      accountType: body.is_gold === true ? "premium" : body.is_mod === true ? "moderator" : undefined,
      accountCreatedAt: isoDateFromUnixSeconds(body.created_utc),
      connectionCount: finiteCount(subreddit?.subscribers),
      followingCount: finiteCount(body.num_friends),
      likesCount: finiteCount(body.total_karma ?? body.link_karma),
      contentCount: finiteCount(body.link_karma),
    };
  }
  if (provider === "discord") {
    const body = await officialJson(
      new URL("https://discord.com/api/users/@me"),
      accessToken,
    );
    const id = typeof body.id === "string" ? body.id : "";
    const username = typeof body.username === "string" ? body.username : "";
    if (!id) return null;
    const avatar =
      typeof body.avatar === "string" && body.avatar
        ? `https://cdn.discordapp.com/avatars/${id}/${body.avatar}.png`
        : undefined;
    const banner =
      typeof body.banner === "string" && body.banner
        ? `https://cdn.discordapp.com/banners/${id}/${body.banner}.png`
        : undefined;
    const nitro =
      body.premium_type === 1
        ? "nitro-classic"
        : body.premium_type === 2
          ? "nitro"
          : body.premium_type === 3
            ? "nitro-basic"
            : undefined;
    return {
      provider,
      providerAccountId: id,
      name: optionalText(body.global_name) || username || undefined,
      handle: username || undefined,
      imageUrl: avatar,
      profileUrl: `https://discord.com/users/${id}`,
      bannerUrl: banner,
      locale: optionalText(body.locale),
      accountType: nitro,
      accountCreatedAt: isoDateFromDiscordSnowflake(id),
    };
  }
  return null;
}

async function officialJson(
  url: URL,
  accessToken: string,
  extraHeaders: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...extraHeaders,
    },
  });
  if (!response.ok) return {};
  const body = (await response.json()) as unknown;
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

async function officialJsonTrying(
  accessToken: string,
  fieldLists: string[],
  buildUrl: (fields: string) => URL,
  isUsable: (body: Record<string, unknown>) => boolean,
  extraHeaders: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  for (const fields of fieldLists) {
    const body = await officialJson(buildUrl(fields), accessToken, extraHeaders);
    if (isUsable(body)) return body;
  }
  return {};
}

export function emptySocialConnections(
  availability: Partial<Record<SocialConnectorId, boolean>> = {},
): SocialConnection[] {
  return SOCIAL_CONNECTORS.map((connector) => ({
    id: connector.id,
    label: connector.label,
    available: Boolean(availability[connector.id]),
    connected: false,
    needsReconnect: false,
    name: null,
    handle: null,
    imageUrl: null,
    profileUrl: null,
    bio: null,
    location: null,
    websiteUrl: null,
    bannerUrl: null,
    locale: null,
    accountType: null,
    accountCreatedAt: null,
    connectionCount: null,
    followingCount: null,
    likesCount: null,
    contentCount: null,
    listedCount: null,
    providerVerified: false,
    connectionLabel: connector.connectionLabel,
  }));
}
