import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APIError } from "better-auth/api";
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
  return betterAuth({
    appName: "Open Marketplace",
    secret,
    baseURL: resolveBaseURL(request),
    trustedOrigins: trustedOriginsFor(request),
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
