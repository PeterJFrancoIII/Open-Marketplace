import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
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
    const host = url.host.toLowerCase();
    if (
      host === "open-marketplace-demo.pages.dev" ||
      host.endsWith(".open-marketplace-demo.pages.dev") ||
      host.startsWith("localhost:") ||
      host === "localhost"
    ) {
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
    const request = requestOrHeaders instanceof Request ? requestOrHeaders : undefined;
    const headerBag = asHeaders(
      request?.headers ?? requestOrHeaders ?? (await nextHeaders()),
    );
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

/** Vinext absolutizes next/navigation redirect() Location headers; boundary tests require a relative path. */
export function marketplaceLoginRedirectResponse(returnTo: string) {
  return new Response(null, {
    status: 307,
    headers: {
      Location: `/login?returnTo=${encodeURIComponent(returnTo)}`,
    },
  });
}

export async function getMarketplaceAdminEmails() {
  const env = await readWorkerEnv();
  return env.MARKETPLACE_ADMIN_EMAILS ?? "";
}
