import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import {
  authAccounts,
  authRateLimits,
  authSessions,
  authUsers,
  authVerifications,
  profiles,
} from "../db/schema";
import {
  FACEBOOK_CONNECT_SCOPES,
  publicFacebookProfileUrl,
  upsertConnectedFacebookAccount,
  withoutConnectedFacebook,
} from "./facebook-listing-proof";
import { parseSocialAccountsJson } from "./profile-settings";
import { computeSocialCreditScore } from "./social-credit";
import {
  connectedSocialCreditInput,
  connectedSocialProof,
  emptySocialConnections,
  isSocialConnectorId,
  readOfficialSocialProfile,
  socialAvailabilityFromEnv,
  SOCIAL_CONNECTORS,
  upsertConnectedSocialAccount,
  withoutConnectedProvider,
  type OfficialSocialProfile,
  type SocialConnection,
  type SocialConnectorId,
} from "./social-connectors";
import type { FacebookConnection, SocialProof } from "./types";

export const FACEBOOK_PUBLIC_PROFILE_SCOPE = "public_profile";
export { FACEBOOK_CONNECT_SCOPES };
export const FACEBOOK_GRAPH_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "middle_name",
  "name",
  "name_format",
  "short_name",
  "picture.type(large)",
  "link",
  "about",
  "website",
  "hometown",
  "location",
  "locale",
  "cover",
  "age_range",
  "gender",
] as const;

const FACEBOOK_GRAPH_FIELDS_CORE = [
  "id",
  "first_name",
  "last_name",
  "middle_name",
  "name",
  "name_format",
  "short_name",
  "picture.type(large)",
  "link",
] as const;

const FACEBOOK_GRAPH_FIELDS_EXTENDED = [
  ...FACEBOOK_GRAPH_FIELDS_CORE,
  "about",
  "website",
  "hometown",
  "location",
] as const;

const PRODUCTION_BASE_URL = "https://open-marketplace-demo.pages.dev";

const DEPLOYED_TRUSTED_ORIGINS = [
  "https://open-marketplace-demo.pages.dev",
  "https://*.open-marketplace-demo.pages.dev",
];

function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") {
    throw new APIError("BAD_REQUEST", {
      message: "Display name must be between 1 and 80 characters.",
    });
  }
  const name = value.trim();
  if (!name || name.length > 80) {
    throw new APIError("BAD_REQUEST", {
      message: "Display name must be between 1 and 80 characters.",
    });
  }
  return name;
}

function isAllowedAuthHost(host: string) {
  return (
    host === "open-marketplace-demo.pages.dev" ||
    host.endsWith(".open-marketplace-demo.pages.dev") ||
    host.startsWith("localhost:") ||
    host === "localhost"
  );
}

function trustedOriginsFor(request?: Request) {
  const origins = [...DEPLOYED_TRUSTED_ORIGINS];
  if (!request) return origins;

  try {
    if (new URL(request.url).hostname === "localhost") {
      origins.push("http://localhost:*", "https://localhost:*");
    }
  } catch {
    // An invalid request URL receives only the deployed-origin allowlist.
  }

  return origins;
}

/** Rebuild a Request URL from Host headers when pages call headers()-based helpers. */
function requestFromHeaders(headerBag: Headers): Request | undefined {
  const host = (
    headerBag.get("x-forwarded-host") ??
    headerBag.get("host") ??
    ""
  )
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (!host || !isAllowedAuthHost(host)) return undefined;

  const forwardedProto = headerBag
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : host === "localhost" || host.startsWith("localhost:")
        ? "http"
        : "https";

  try {
    return new Request(`${protocol}://${host}/`);
  } catch {
    return undefined;
  }
}

type CloudflareEnv = {
  BETTER_AUTH_SECRET?: string;
  MARKETPLACE_ADMIN_EMAILS?: string;
  FACEBOOK_CLIENT_ID?: string;
  FACEBOOK_CLIENT_SECRET?: string;
  INSTAGRAM_CLIENT_ID?: string;
  INSTAGRAM_CLIENT_SECRET?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
};

async function readWorkerEnv(): Promise<CloudflareEnv> {
  const { env } = await import("cloudflare:workers");
  return env as CloudflareEnv;
}

function resolveBaseURL(request?: Request) {
  if (!request) return PRODUCTION_BASE_URL;
  try {
    const url = new URL(request.url);
    if (isAllowedAuthHost(url.host.toLowerCase())) {
      return url.origin;
    }
  } catch {
    // Fall through to the production demo host.
  }
  return PRODUCTION_BASE_URL;
}

export async function getMarketplaceAuth(request?: Request) {
  const env = await readWorkerEnv();
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for authentication.");
  }

  const db = await getDb();
  const facebookClientId = env.FACEBOOK_CLIENT_ID?.trim();
  const facebookClientSecret = env.FACEBOOK_CLIENT_SECRET?.trim();
  const facebookConnectEnabled = Boolean(
    facebookClientId && facebookClientSecret,
  );
  const availability = socialAvailabilityFromEnv(env);
  const socialProviders = buildSocialProviders(env, {
    facebookClientId,
    facebookClientSecret,
    facebookConnectEnabled,
  });
  const instagramEnabled = availability.instagram;
  const trustedProviders = SOCIAL_CONNECTORS.filter(
    (connector) => availability[connector.id],
  ).map((connector) => connector.id);

  return betterAuth({
    appName: "Open Marketplace",
    secret,
    baseURL: resolveBaseURL(request),
    trustedOrigins: trustedOriginsFor(request),
    socialProviders,
    plugins: instagramEnabled
      ? [
          genericOAuth({
            config: [
              {
                providerId: "instagram",
                clientId: env.INSTAGRAM_CLIENT_ID!.trim(),
                clientSecret: env.INSTAGRAM_CLIENT_SECRET!.trim(),
                authorizationUrl: "https://www.instagram.com/oauth/authorize",
                tokenUrl: "https://api.instagram.com/oauth/access_token",
                // Better Auth sends /api/auth/oauth2/callback/instagram.
                scopes: [...SOCIAL_CONNECTORS.find((item) => item.id === "instagram")!.scopes],
                disableSignUp: true,
                getUserInfo: async (tokens) => {
                  const accessToken = tokens.accessToken;
                  if (!accessToken) return null;
                  const profile = await readOfficialSocialProfile(
                    "instagram",
                    accessToken,
                  );
                  if (!profile) return null;
                  return {
                    id: profile.providerAccountId,
                    name: profile.name ?? profile.handle,
                    emailVerified: false,
                  };
                },
              },
            ],
          }),
        ]
      : [],
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        updateUserInfoOnLink: false,
        trustedProviders,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = String(ctx.path ?? "");
        const body =
          ctx.body && typeof ctx.body === "object"
            ? (ctx.body as { provider?: unknown; providerId?: unknown })
            : {};
        const provider =
          typeof body.provider === "string"
            ? body.provider
            : typeof body.providerId === "string"
              ? body.providerId
              : "";
        if (
          (path === "/sign-in/social" ||
            path.endsWith("/sign-in/social") ||
            path === "/sign-in/oauth2" ||
            path.endsWith("/sign-in/oauth2")) &&
          (isSocialConnectorId(provider) ||
            provider === "paypal" ||
            path.includes("oauth2"))
        ) {
          throw new APIError("BAD_REQUEST", {
            message:
              provider === "paypal"
                ? "PayPal is an account connector only. Sign in with email."
                : "Social networks are account connectors only. Sign in with email.",
          });
        }
        if (
          path === "/get-access-token" ||
          path.endsWith("/get-access-token") ||
          path === "/refresh-token" ||
          path.endsWith("/refresh-token")
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Social connector tokens stay on the server.",
          });
        }
      }),
    },
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        rateLimit: authRateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, name: normalizeDisplayName(user.name) },
          }),
        },
        update: {
          before: async (user) => {
            if (user.name === undefined) return;
            return {
              data: { ...user, name: normalizeDisplayName(user.name) },
            };
          },
        },
      },
      account: {
        create: {
          after: async (account) => {
            await persistLinkedSocialAccount(account);
          },
        },
        update: {
          after: async (account) => {
            await persistLinkedSocialAccount(account);
          },
        },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"],
      },
      database: {
        generateId: "uuid",
      },
    },
  });
}

function asHeaders(source: Headers | Awaited<ReturnType<typeof nextHeaders>>) {
  if (source instanceof Headers) return source;
  const headersInit = new Headers();
  source.forEach((value, key) => {
    headersInit.append(key, value);
  });
  return headersInit;
}

export async function getMarketplaceSession(
  requestOrHeaders?:
    | Request
    | Headers
    | Awaited<ReturnType<typeof nextHeaders>>,
) {
  try {
    const headerBag = asHeaders(
      requestOrHeaders instanceof Request
        ? requestOrHeaders.headers
        : (requestOrHeaders ?? (await nextHeaders())),
    );
    const request =
      requestOrHeaders instanceof Request
        ? requestOrHeaders
        : requestFromHeaders(headerBag);
    const auth = await getMarketplaceAuth(request);
    return await auth.api.getSession({ headers: headerBag });
  } catch {
    return null;
  }
}

export async function requireMarketplaceSession(
  requestHeaders: Headers | Awaited<ReturnType<typeof nextHeaders>>,
  returnTo: string,
) {
  const session = await getMarketplaceSession(requestHeaders);
  if (!session) {
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}

export async function getMarketplaceAdminEmails() {
  const env = await readWorkerEnv();
  return env.MARKETPLACE_ADMIN_EMAILS ?? "";
}

export async function getFacebookConnectAvailability() {
  const env = await readWorkerEnv();
  return Boolean(env.FACEBOOK_CLIENT_ID?.trim() && env.FACEBOOK_CLIENT_SECRET?.trim());
}

function connectorScopes(id: SocialConnectorId) {
  return [...(SOCIAL_CONNECTORS.find((connector) => connector.id === id)?.scopes ?? [])];
}

function buildSocialProviders(
  env: CloudflareEnv,
  facebook: {
    facebookClientId?: string;
    facebookClientSecret?: string;
    facebookConnectEnabled: boolean;
  },
) {
  const availability = socialAvailabilityFromEnv(env);
  const providers: Record<string, Record<string, unknown>> = {};
  if (facebook.facebookConnectEnabled) {
    providers.facebook = {
      clientId: facebook.facebookClientId!,
      clientSecret: facebook.facebookClientSecret!,
      disableDefaultScope: true,
      scope: [...FACEBOOK_CONNECT_SCOPES],
      disableSignUp: true,
      disableImplicitSignUp: true,
      disableIdTokenSignIn: true,
      getUserInfo: async (token: { accessToken?: string }) => {
        const accessToken = token.accessToken;
        if (!accessToken) return null;
        const profile = await readFacebookPublicProfile(
          accessToken,
          facebook.facebookClientId!,
          facebook.facebookClientSecret!,
        );
        if (!profile) return null;
        return {
          user: {
            id: profile.id,
            name: profile.name,
            image: profile.image,
            emailVerified: false,
          },
          data: profile,
        };
      },
    };
  }
  if (availability.tiktok) {
    providers.tiktok = {
      clientId: env.TIKTOK_CLIENT_KEY!.trim(),
      clientKey: env.TIKTOK_CLIENT_KEY!.trim(),
      clientSecret: env.TIKTOK_CLIENT_SECRET!.trim(),
      disableDefaultScope: true,
      scope: connectorScopes("tiktok"),
      disableSignUp: true,
      disableImplicitSignUp: true,
      disableIdTokenSignIn: true,
      getUserInfo: async (token: { accessToken?: string }) => {
        const accessToken = token.accessToken;
        if (!accessToken) return null;
        const profile = await readOfficialSocialProfile("tiktok", accessToken);
        if (!profile) return null;
        return {
          user: {
            id: profile.providerAccountId,
            name: profile.name ?? "TikTok",
            emailVerified: false,
          },
          data: profile,
        };
      },
    };
  }
  if (availability.twitter) {
    providers.twitter = {
      clientId: env.TWITTER_CLIENT_ID!.trim(),
      clientSecret: env.TWITTER_CLIENT_SECRET!.trim(),
      scope: connectorScopes("twitter"),
      disableSignUp: true,
      disableImplicitSignUp: true,
    };
  }
  if (availability.linkedin) {
    providers.linkedin = {
      clientId: env.LINKEDIN_CLIENT_ID!.trim(),
      clientSecret: env.LINKEDIN_CLIENT_SECRET!.trim(),
      disableDefaultScope: true,
      scope: connectorScopes("linkedin"),
      disableSignUp: true,
      disableImplicitSignUp: true,
    };
  }
  if (availability.reddit) {
    providers.reddit = {
      clientId: env.REDDIT_CLIENT_ID!.trim(),
      clientSecret: env.REDDIT_CLIENT_SECRET!.trim(),
      duration: "permanent",
      scope: connectorScopes("reddit"),
      disableSignUp: true,
      disableImplicitSignUp: true,
    };
  }
  if (availability.discord) {
    providers.discord = {
      clientId: env.DISCORD_CLIENT_ID!.trim(),
      clientSecret: env.DISCORD_CLIENT_SECRET!.trim(),
      disableDefaultScope: true,
      scope: connectorScopes("discord"),
      disableSignUp: true,
      disableImplicitSignUp: true,
    };
  }
  return providers;
}

async function persistLinkedSocialAccount(account: {
  providerId: string;
  userId: string;
  accessToken?: string | null;
}) {
  if (!isSocialConnectorId(account.providerId)) return;
  const db = await getDb();
  const [user] = await db
    .select({ name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, account.userId))
    .limit(1);
  const displayName = user?.name ?? account.providerId;
  if (account.providerId === "facebook") {
    await persistFacebookProfileLink(
      account.userId,
      displayName,
      undefined,
      account.accessToken,
    );
    return;
  }
  await persistSocialConnectorLink(
    account.userId,
    displayName,
    account.providerId,
    account.accessToken,
  );
}

function publicFacebookImageUrl(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol === "https:" &&
      (host === "graph.facebook.com" ||
        host.endsWith(".facebook.com") ||
        host.endsWith(".fbcdn.net") ||
        host.endsWith(".fbsbx.com"))
    ) {
      return url.toString();
    }
  } catch {
    // Provider-supplied picture URLs that are not HTTPS Facebook hosts are dropped.
  }
  return null;
}

type FacebookPublicProfile = {
  id?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  name?: string;
  name_format?: string;
  short_name?: string;
  picture?: { data?: { url?: string } };
  link?: string;
  about?: string;
  website?: string;
  hometown?: { name?: string };
  location?: { name?: string };
  locale?: string;
  gender?: string;
  age_range?: { min?: number; max?: number };
  cover?: { source?: string };
};

function facebookPlaceName(value?: { name?: string } | string | null) {
  if (typeof value === "string") {
    const name = value.trim();
    return name && name.length <= 120 ? name : null;
  }
  const name = value?.name?.trim() ?? "";
  return name && name.length <= 120 ? name : null;
}

function trimFacebookName(value?: string | null) {
  const name = value?.trim() ?? "";
  return name && name.length <= 80 ? name : null;
}

function facebookAgeRange(value?: { min?: number; max?: number } | null) {
  const min = Number(value?.min);
  const max = Number(value?.max);
  if (Number.isFinite(min) && Number.isFinite(max)) return `${min}-${max}`;
  if (Number.isFinite(min)) return `${min}+`;
  return null;
}

function displayNameFromFacebook(profile: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  return (
    trimFacebookName(profile.name) ??
    trimFacebookName(
      [profile.firstName, profile.lastName].filter(Boolean).join(" "),
    )
  );
}

async function readFacebookPublicProfile(
  accessToken: string,
  clientId: string,
  clientSecret: string,
) {
  const debugUrl = new URL("https://graph.facebook.com/debug_token");
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", `${clientId}|${clientSecret}`);
  const debugResponse = await fetch(debugUrl);
  if (!debugResponse.ok) return null;
  const debugBody = (await debugResponse.json()) as {
    data?: { is_valid?: boolean; app_id?: string; user_id?: string };
  };
  const debug = debugBody.data;
  if (debug?.is_valid !== true || debug.app_id !== clientId || !debug.user_id) {
    return null;
  }

  const profile = await readFacebookGraphMe(accessToken, debug.user_id);
  if (!profile) return null;

  return {
    id: profile.id,
    firstName: trimFacebookName(profile.first_name),
    lastName: trimFacebookName(profile.last_name),
    middleName: trimFacebookName(profile.middle_name),
    shortName: trimFacebookName(profile.short_name),
    name: displayNameFromFacebook({
      name: profile.name,
      firstName: profile.first_name,
      lastName: profile.last_name,
    }),
    image: publicFacebookImageUrl(profile.picture?.data?.url) ?? undefined,
    link: publicFacebookProfileUrl(profile.link) || undefined,
    about: facebookPlaceName(profile.about),
    website: facebookPlaceName(profile.website),
    hometown: facebookPlaceName(profile.hometown),
    location: facebookPlaceName(profile.location),
    locale: facebookPlaceName(profile.locale),
    gender: facebookPlaceName(profile.gender),
    ageRange: facebookAgeRange(profile.age_range),
    cover: publicFacebookImageUrl(profile.cover?.source) ?? undefined,
  };
}

async function readFacebookGraphMe(accessToken: string, userId: string) {
  for (const fields of [
    FACEBOOK_GRAPH_FIELDS,
    FACEBOOK_GRAPH_FIELDS_EXTENDED,
    FACEBOOK_GRAPH_FIELDS_CORE,
  ]) {
    const meUrl = new URL("https://graph.facebook.com/me");
    meUrl.searchParams.set("fields", fields.join(","));
    const meResponse = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meResponse.ok) continue;
    const profile = (await meResponse.json()) as FacebookPublicProfile;
    if (profile.id && profile.id === userId) return profile;
  }
  return null;
}

function publicFacebookConnection(
  available: boolean,
  connected: boolean,
  profile?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    shortName?: string | null;
    image?: string | null;
    link?: string | null;
    about?: string | null;
    website?: string | null;
    hometown?: string | null;
    location?: string | null;
    locale?: string | null;
    gender?: string | null;
    ageRange?: string | null;
    cover?: string | null;
  },
): FacebookConnection {
  if (!connected) {
    return {
      available,
      connected: false,
      name: null,
      firstName: null,
      lastName: null,
      middleName: null,
      shortName: null,
      imageUrl: null,
      profileUrl: null,
      about: null,
      location: null,
      hometown: null,
      websiteUrl: null,
      locale: null,
      gender: null,
      ageRange: null,
      coverUrl: null,
    };
  }
  return {
    available,
    connected: true,
    name: displayNameFromFacebook(profile ?? {}),
    firstName: trimFacebookName(profile?.firstName),
    lastName: trimFacebookName(profile?.lastName),
    middleName: trimFacebookName(profile?.middleName),
    shortName: trimFacebookName(profile?.shortName),
    imageUrl: publicFacebookImageUrl(profile?.image),
    profileUrl: publicFacebookProfileUrl(profile?.link) || null,
    about: profile?.about?.trim() || null,
    location: profile?.location?.trim() || null,
    hometown: profile?.hometown?.trim() || null,
    websiteUrl: profile?.website?.trim() || null,
    locale: profile?.locale?.trim() || null,
    gender: profile?.gender?.trim() || null,
    ageRange: profile?.ageRange?.trim() || null,
    coverUrl: publicFacebookImageUrl(profile?.cover),
  };
}

export async function persistFacebookProfileLink(
  userId: string,
  displayName: string,
  knownLink?: string | null,
  accessToken?: string | null,
  knownOfficial?: Awaited<ReturnType<typeof readFacebookPublicProfile>> | null,
) {
  const db = await getDb();
  const [facebook] = await db
    .select({
      accessToken: authAccounts.accessToken,
    })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, "facebook")),
    )
    .limit(1);

  const [profileRow] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const current = parseSocialAccountsJson(profileRow?.socialAccountsJson);
  const token = accessToken || facebook?.accessToken;
  const official =
    knownOfficial ?? (token ? await readStoredFacebookOfficial(token) : null);
  const fetchedLink =
    publicFacebookProfileUrl(knownLink) || official?.link || "";
  const connected = Boolean(facebook || token);
  const next = connected
    ? upsertConnectedFacebookAccount(current, displayName, fetchedLink, {
        displayName: official?.name,
        firstName: official?.firstName,
        lastName: official?.lastName,
        middleName: official?.middleName,
        shortName: official?.shortName,
        imageUrl: official?.image,
        bio: official?.about,
        location: official?.location,
        hometown: official?.hometown,
        websiteUrl: official?.website,
        bannerUrl: official?.cover,
        locale: official?.locale,
        gender: official?.gender,
        ageRange: official?.ageRange,
        hasOfficialImage: Boolean(official?.image),
        hasBio: Boolean(official?.about),
        hasLocation: Boolean(official?.location || official?.hometown),
        hasWebsite: Boolean(official?.website),
        hasBanner: Boolean(official?.cover),
      })
    : withoutConnectedFacebook(current);
  await writeProfileSocialAccounts(userId, displayName, next, profileRow);
  return publicFacebookProfileUrl(
    next.find((account) => account.provider === "facebook")?.url,
  );
}

export async function persistSocialConnectorLink(
  userId: string,
  displayName: string,
  provider: SocialConnectorId,
  accessToken?: string | null,
) {
  if (provider === "facebook") {
    return persistFacebookProfileLink(userId, displayName, undefined, accessToken);
  }
  const db = await getDb();
  const [account] = await db
    .select({ accessToken: authAccounts.accessToken })
    .from(authAccounts)
    .where(
      and(eq(authAccounts.userId, userId), eq(authAccounts.providerId, provider)),
    )
    .limit(1);
  const [profileRow] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const current = parseSocialAccountsJson(profileRow?.socialAccountsJson);
  const token = accessToken || account?.accessToken;
  if (!account && !token) {
    await writeProfileSocialAccounts(
      userId,
      displayName,
      withoutConnectedProvider(current, provider),
      profileRow,
    );
    return;
  }
  const official = token
    ? await readOfficialSocialProfile(provider, token)
    : null;
  if (provider === "tiktok" && !official) {
    await writeProfileSocialAccounts(
      userId,
      displayName,
      withoutConnectedProvider(current, provider),
      profileRow,
    );
    return;
  }
  const profile: OfficialSocialProfile = official ?? {
    provider,
    providerAccountId: "",
    name: displayName,
  };
  await writeProfileSocialAccounts(
    userId,
    displayName,
    upsertConnectedSocialAccount(current, profile, displayName),
    profileRow,
  );
}

export async function persistAllConnectedSocial(
  userId: string,
  displayName: string,
) {
  const db = await getDb();
  const accounts = await db
    .select({
      providerId: authAccounts.providerId,
      accessToken: authAccounts.accessToken,
    })
    .from(authAccounts)
    .where(eq(authAccounts.userId, userId));
  const connected = new Set<SocialConnectorId>();
  for (const account of accounts) {
    if (!isSocialConnectorId(account.providerId)) continue;
    connected.add(account.providerId);
    if (account.providerId === "facebook") {
      await persistFacebookProfileLink(
        userId,
        displayName,
        undefined,
        account.accessToken,
      );
      continue;
    }
    await persistSocialConnectorLink(
      userId,
      displayName,
      account.providerId,
      account.accessToken,
    );
  }
  const [profileRow] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const kept = parseSocialAccountsJson(profileRow?.socialAccountsJson).filter(
    (account) =>
      isSocialConnectorId(account.provider) && connected.has(account.provider),
  );
  await writeProfileSocialAccounts(userId, displayName, kept, profileRow);
}

export async function listConnectedSocialProviderIds(userId: string) {
  const db = await getDb();
  const accounts = await db
    .select({ providerId: authAccounts.providerId })
    .from(authAccounts)
    .where(eq(authAccounts.userId, userId));
  return accounts
    .map((account) => account.providerId)
    .filter(isSocialConnectorId);
}

async function writeProfileSocialAccounts(
  userId: string,
  displayName: string,
  next: SocialProof[],
  profileRow?: typeof profiles.$inferSelect,
) {
  const db = await getDb();
  const socialAccountsJson = JSON.stringify(next);
  const socialCreditScore = computeSocialCreditScore({
    sellerRating: profileRow?.sellerRating,
    sellerRatingCount: profileRow?.sellerRatingCount,
    buyerRating: profileRow?.buyerRating,
    buyerRatingCount: profileRow?.buyerRatingCount,
    itemsSold: profileRow?.itemsSold ?? 0,
    connectedSocial: connectedSocialCreditInput(next),
  });
  if (
    profileRow?.socialAccountsJson === socialAccountsJson &&
    profileRow.socialCreditScore === socialCreditScore
  ) {
    return;
  }
  const updatedAt = new Date().toISOString();
  if (profileRow) {
    await db
      .update(profiles)
      .set({ socialAccountsJson, socialCreditScore, updatedAt })
      .where(eq(profiles.id, userId));
    return;
  }
  await db.insert(profiles).values({
    id: userId,
    displayName,
    socialAccountsJson,
    socialCreditScore,
    updatedAt,
  });
}

async function readStoredFacebookOfficial(accessToken?: string | null) {
  const env = await readWorkerEnv();
  const clientId = env.FACEBOOK_CLIENT_ID?.trim();
  const clientSecret = env.FACEBOOK_CLIENT_SECRET?.trim();
  if (!accessToken || !clientId || !clientSecret) return null;
  return readFacebookPublicProfile(accessToken, clientId, clientSecret);
}

export async function getFacebookConnection(
  requestOrHeaders?:
    | Request
    | Headers
    | Awaited<ReturnType<typeof nextHeaders>>,
): Promise<FacebookConnection> {
  const available = await getFacebookConnectAvailability();
  if (!available) {
    return publicFacebookConnection(false, false);
  }

  try {
    const headerBag = asHeaders(
      requestOrHeaders instanceof Request
        ? requestOrHeaders.headers
        : (requestOrHeaders ?? (await nextHeaders())),
    );
    const request =
      requestOrHeaders instanceof Request
        ? requestOrHeaders
        : requestFromHeaders(headerBag);
    const auth = await getMarketplaceAuth(request);
    const session = await auth.api.getSession({ headers: headerBag });
    if (!session?.user) {
      return publicFacebookConnection(true, false);
    }

    const db = await getDb();
    const [facebook] = await db
      .select({
        accessToken: authAccounts.accessToken,
      })
      .from(authAccounts)
      .where(
        and(
          eq(authAccounts.userId, session.user.id),
          eq(authAccounts.providerId, "facebook"),
        ),
      )
      .limit(1);
    if (!facebook) {
      await persistFacebookProfileLink(session.user.id, session.user.name);
      return publicFacebookConnection(true, false);
    }

    let profile:
      | Awaited<ReturnType<typeof readFacebookPublicProfile>>
      | null = null;
    const env = await readWorkerEnv();
    const clientId = env.FACEBOOK_CLIENT_ID?.trim();
    const clientSecret = env.FACEBOOK_CLIENT_SECRET?.trim();
    if (facebook.accessToken && clientId && clientSecret) {
      profile = await readFacebookPublicProfile(
        facebook.accessToken,
        clientId,
        clientSecret,
      );
    }
    await persistFacebookProfileLink(
      session.user.id,
      session.user.name,
      profile?.link ?? "",
      facebook.accessToken,
      profile,
    );

    return publicFacebookConnection(true, true, profile ?? undefined);
  } catch {
    return publicFacebookConnection(true, false);
  }
}

export async function getSocialConnections(
  requestOrHeaders?:
    | Request
    | Headers
    | Awaited<ReturnType<typeof nextHeaders>>,
): Promise<SocialConnection[]> {
  const env = await readWorkerEnv();
  const availability = socialAvailabilityFromEnv(env);
  const empty = emptySocialConnections(availability);
  try {
    const headerBag = asHeaders(
      requestOrHeaders instanceof Request
        ? requestOrHeaders.headers
        : (requestOrHeaders ?? (await nextHeaders())),
    );
    const request =
      requestOrHeaders instanceof Request
        ? requestOrHeaders
        : requestFromHeaders(headerBag);
    const auth = await getMarketplaceAuth(request);
    const session = await auth.api.getSession({ headers: headerBag });
    if (!session?.user) return empty;

    const db = await getDb();
    const accounts = await db
      .select({
        providerId: authAccounts.providerId,
        accessToken: authAccounts.accessToken,
      })
      .from(authAccounts)
      .where(eq(authAccounts.userId, session.user.id));
    const connected = new Set(
      accounts.map((account) => account.providerId).filter(isSocialConnectorId),
    );
    const [profileRow] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1);
    let proofs = parseSocialAccountsJson(profileRow?.socialAccountsJson).filter(
      (account) =>
        isSocialConnectorId(account.provider) && connected.has(account.provider),
    );
    const officialById = new Map<SocialConnectorId, OfficialSocialProfile>();
    let tiktokNeedsReconnect = false;
    for (const account of accounts) {
      if (!isSocialConnectorId(account.providerId) || account.providerId === "facebook") {
        continue;
      }
      const official = account.accessToken
        ? await readOfficialSocialProfile(account.providerId, account.accessToken)
        : null;
      if (account.providerId === "tiktok" && !official) {
        tiktokNeedsReconnect = true;
        proofs = proofs.filter((item) => item.provider !== "tiktok");
        continue;
      }
      if (official) {
        officialById.set(account.providerId, official);
        proofs = [
          ...proofs.filter((item) => item.provider !== account.providerId),
          connectedSocialProof(official, session.user.name),
        ];
      }
    }
    if (
      JSON.stringify(proofs) !==
      JSON.stringify(parseSocialAccountsJson(profileRow?.socialAccountsJson))
    ) {
      await writeProfileSocialAccounts(
        session.user.id,
        session.user.name,
        proofs,
        profileRow,
      );
    }

    return SOCIAL_CONNECTORS.map((connector) => {
      const official = officialById.get(connector.id);
      const proof = proofs.find((account) => account.provider === connector.id);
      const countOrNull = (value?: number | null) =>
        typeof value === "number" ? value : null;
      return {
        id: connector.id,
        label: connector.label,
        available: availability[connector.id],
        connected:
          connector.id === "tiktok"
            ? Boolean(official)
            : connected.has(connector.id),
        needsReconnect: connector.id === "tiktok" ? tiktokNeedsReconnect : false,
        name: official?.name ?? proof?.displayName ?? proof?.handle ?? null,
        handle: official?.handle ?? proof?.handle ?? null,
        imageUrl: official?.imageUrl ?? null,
        profileUrl: official?.profileUrl || proof?.url || null,
        bio: official?.bio ?? null,
        location: official?.location ?? null,
        websiteUrl: official?.websiteUrl ?? null,
        bannerUrl: official?.bannerUrl ?? null,
        locale: official?.locale ?? null,
        accountType: official?.accountType ?? null,
        accountCreatedAt:
          official?.accountCreatedAt ?? proof?.accountCreatedAt ?? null,
        connectionCount: countOrNull(
          official?.connectionCount ?? proof?.connectionCount,
        ),
        followingCount: countOrNull(
          official?.followingCount ?? proof?.followingCount,
        ),
        likesCount: countOrNull(official?.likesCount ?? proof?.likesCount),
        contentCount: countOrNull(official?.contentCount ?? proof?.contentCount),
        listedCount: countOrNull(official?.listedCount ?? proof?.listedCount),
        providerVerified: official?.providerVerified === true,
        connectionLabel: connector.connectionLabel,
      };
    });
  } catch {
    return empty;
  }
}
