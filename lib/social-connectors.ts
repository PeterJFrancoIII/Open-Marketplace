import type { SocialProof } from "./types";

export const SOCIAL_CONNECTOR_IDS = [
  "facebook",
  "instagram",
  "tiktok",
  "twitter",
  "linkedin",
  "reddit",
  "discord",
] as const;

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
    scopes: ["public_profile", "user_link"],
    connectionLabel: "friends",
    hosts: ["facebook.com", "fb.com"],
  },
  {
    id: "instagram",
    label: "Instagram",
    envId: "INSTAGRAM_CLIENT_ID",
    envSecret: "INSTAGRAM_CLIENT_SECRET",
    scopes: ["user_profile"],
    connectionLabel: "followers",
    hosts: ["instagram.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    envId: "TIKTOK_CLIENT_KEY",
    envSecret: "TIKTOK_CLIENT_SECRET",
    envKey: "TIKTOK_CLIENT_KEY",
    scopes: ["user.info.basic", "user.info.profile", "user.info.stats"],
    connectionLabel: "followers",
    hosts: ["tiktok.com"],
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
  accountCreatedAt?: string;
  connectionCount?: number;
};

export type SocialConnection = {
  id: SocialConnectorId;
  label: string;
  available: boolean;
  connected: boolean;
  name: string | null;
  handle: string | null;
  imageUrl: string | null;
  profileUrl: string | null;
  accountCreatedAt: string | null;
  connectionCount: number | null;
  connectionLabel: SocialProof["connectionLabel"];
};

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
  return {
    provider: profile.provider,
    url: publicSocialProfileUrl(profile.provider, profile.profileUrl),
    handle,
    accountCreatedAt: profile.accountCreatedAt,
    connectionCount: Number.isFinite(profile.connectionCount)
      ? profile.connectionCount
      : undefined,
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
    if (!connected.has(account.provider)) continue;
    byProvider.set(account.provider, {
      ...account,
      url: publicSocialProfileUrl(account.provider, account.url),
      metricsSource: "oauth",
      health: "active",
    });
  }
  for (const provider of connected) {
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
        account.metricsSource === "oauth" && isSocialConnectorId(account.provider),
    )
    .map((account) => ({
      provider: account.provider,
      hasProfileUrl: Boolean(
        publicSocialProfileUrl(account.provider as SocialConnectorId, account.url),
      ),
      hasHandle: Boolean(account.handle?.trim()),
      hasDisplayName: Boolean(account.handle?.trim()),
      hasAccountCreatedAt: Boolean(account.accountCreatedAt),
      hasConnectionCount: Number.isFinite(account.connectionCount),
      hasImage: false,
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

export async function readOfficialSocialProfile(
  provider: SocialConnectorId,
  accessToken: string,
): Promise<OfficialSocialProfile | null> {
  if (!accessToken.trim()) return null;
  if (provider === "facebook") return null;
  if (provider === "instagram") {
    const url = new URL("https://graph.instagram.com/me");
    url.searchParams.set("fields", "id,username,account_type,name");
    const body = await officialJson(url, accessToken);
    const id = typeof body.id === "string" ? body.id : "";
    const username = typeof body.username === "string" ? body.username : "";
    if (!id || !username) return null;
    return {
      provider,
      providerAccountId: id,
      name: typeof body.name === "string" ? body.name : username,
      handle: username,
      profileUrl: `https://www.instagram.com/${username}`,
    };
  }
  if (provider === "tiktok") {
    const url = new URL("https://open.tiktokapis.com/v2/user/info/");
    url.searchParams.set(
      "fields",
      "open_id,union_id,avatar_url,display_name,username,follower_count,profile_deep_link",
    );
    const body = await officialJson(url, accessToken);
    const user = (body.data as { user?: Record<string, unknown> } | undefined)?.user;
    const id = typeof user?.open_id === "string" ? user.open_id : "";
    if (!id) return null;
    const username = typeof user.username === "string" ? user.username : "";
    return {
      provider,
      providerAccountId: id,
      name: typeof user.display_name === "string" ? user.display_name : username,
      handle: username || undefined,
      imageUrl: typeof user.avatar_url === "string" ? user.avatar_url : undefined,
      profileUrl:
        typeof user.profile_deep_link === "string"
          ? user.profile_deep_link
          : username
            ? `https://www.tiktok.com/@${username}`
            : undefined,
      connectionCount: finiteCount(user.follower_count),
    };
  }
  if (provider === "twitter") {
    const url = new URL("https://api.twitter.com/2/users/me");
    url.searchParams.set(
      "user.fields",
      "created_at,public_metrics,username,name,profile_image_url,verified",
    );
    const body = await officialJson(url, accessToken);
    const user = body.data as Record<string, unknown> | undefined;
    const id = typeof user?.id === "string" ? user.id : "";
    const username = typeof user?.username === "string" ? user.username : "";
    if (!id || !username) return null;
    const metrics = user.public_metrics as { followers_count?: unknown } | undefined;
    return {
      provider,
      providerAccountId: id,
      name: typeof user.name === "string" ? user.name : username,
      handle: username,
      imageUrl:
        typeof user.profile_image_url === "string"
          ? user.profile_image_url
          : undefined,
      profileUrl: `https://x.com/${username}`,
      accountCreatedAt: isoDateFromIso(user.created_at),
      connectionCount: finiteCount(metrics?.followers_count),
    };
  }
  if (provider === "linkedin") {
    const body = await officialJson(
      new URL("https://api.linkedin.com/v2/userinfo"),
      accessToken,
    );
    const id = typeof body.sub === "string" ? body.sub : "";
    if (!id) return null;
    return {
      provider,
      providerAccountId: id,
      name: typeof body.name === "string" ? body.name : undefined,
      imageUrl: typeof body.picture === "string" ? body.picture : undefined,
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
    return {
      provider,
      providerAccountId: id,
      name,
      handle: name,
      imageUrl: typeof body.icon_img === "string" ? body.icon_img : undefined,
      profileUrl: `https://www.reddit.com/user/${name}`,
      accountCreatedAt: isoDateFromUnixSeconds(body.created_utc),
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
    return {
      provider,
      providerAccountId: id,
      name:
        (typeof body.global_name === "string" && body.global_name) ||
        username ||
        undefined,
      handle: username || undefined,
      profileUrl: `https://discord.com/users/${id}`,
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

export function emptySocialConnections(
  availability: Partial<Record<SocialConnectorId, boolean>> = {},
): SocialConnection[] {
  return SOCIAL_CONNECTORS.map((connector) => ({
    id: connector.id,
    label: connector.label,
    available: Boolean(availability[connector.id]),
    connected: false,
    name: null,
    handle: null,
    imageUrl: null,
    profileUrl: null,
    accountCreatedAt: null,
    connectionCount: null,
    connectionLabel: connector.connectionLabel,
  }));
}
