import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import {
  authAccounts,
  authRateLimits,
  authSessions,
  authUsers,
  authVerifications,
} from "../db/schema";
import type { FacebookConnection } from "./types";

export const FACEBOOK_PUBLIC_PROFILE_SCOPE = "public_profile";
export const FACEBOOK_GRAPH_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "middle_name",
  "name",
  "name_format",
  "short_name",
  "picture.type(large)",
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

  return betterAuth({
    appName: "Open Marketplace",
    secret,
    baseURL: resolveBaseURL(request),
    trustedOrigins: trustedOriginsFor(request),
    socialProviders: facebookConnectEnabled
      ? {
          facebook: {
            clientId: facebookClientId!,
            clientSecret: facebookClientSecret!,
            disableDefaultScope: true,
            scope: [FACEBOOK_PUBLIC_PROFILE_SCOPE],
            disableSignUp: true,
            disableImplicitSignUp: true,
            disableIdTokenSignIn: true,
            getUserInfo: async (token) => {
              const accessToken = token.accessToken;
              if (!accessToken) return null;
              const profile = await readFacebookPublicProfile(
                accessToken,
                facebookClientId!,
                facebookClientSecret!,
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
          },
        }
      : {},
    account: {
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: true,
        updateUserInfoOnLink: false,
        trustedProviders: ["facebook"],
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = String(ctx.path ?? "");
        const body =
          ctx.body && typeof ctx.body === "object"
            ? (ctx.body as { provider?: unknown; providerId?: unknown })
            : {};
        if (
          (path === "/sign-in/social" || path.endsWith("/sign-in/social")) &&
          (body.provider === "facebook" || body.provider === "paypal")
        ) {
          throw new APIError("BAD_REQUEST", {
            message:
              body.provider === "paypal"
                ? "PayPal is an account connector only. Sign in with email."
                : "Facebook is an account connector only. Sign in with email.",
          });
        }
        if (
          path === "/get-access-token" ||
          path.endsWith("/get-access-token") ||
          path === "/refresh-token" ||
          path.endsWith("/refresh-token")
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Facebook tokens stay on the server.",
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
};

function trimFacebookName(value?: string | null) {
  const name = value?.trim() ?? "";
  return name && name.length <= 80 ? name : null;
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

  const meUrl = new URL("https://graph.facebook.com/me");
  meUrl.searchParams.set("fields", FACEBOOK_GRAPH_FIELDS.join(","));
  const meResponse = await fetch(meUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meResponse.ok) return null;
  const profile = (await meResponse.json()) as FacebookPublicProfile;
  if (!profile.id || profile.id !== debug.user_id) return null;

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
  };
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
  };
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

    return publicFacebookConnection(true, true, profile ?? undefined);
  } catch {
    return publicFacebookConnection(true, false);
  }
}
