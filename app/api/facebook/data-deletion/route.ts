import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { authAccounts } from "../../../../db/schema";
import {
  createDeletionConfirmation,
  deletionStatusUrl,
  parseFacebookSignedRequest,
  verifyDeletionConfirmation,
} from "../../../../lib/facebook-data-deletion";

type WorkerEnv = {
  FACEBOOK_CLIENT_SECRET?: string;
  BETTER_AUTH_SECRET?: string;
};

const PREVIEW_HOST_SUFFIX = ".open-marketplace-demo.pages.dev";
const PRODUCTION_ORIGIN = "https://open-marketplace-demo.pages.dev";

function isAllowedHost(host: string) {
  return (
    host === "open-marketplace-demo.pages.dev" ||
    host.endsWith(PREVIEW_HOST_SUFFIX) ||
    host === "localhost" ||
    host.startsWith("localhost:")
  );
}

function requestOrigin(request: Request) {
  try {
    const url = new URL(request.url);
    if (isAllowedHost(url.host.toLowerCase())) return url.origin;
  } catch {
    // Fall through to the public production origin.
  }
  return PRODUCTION_ORIGIN;
}

async function readEnv(): Promise<WorkerEnv> {
  const { env } = (await import("cloudflare:workers")) as { env: WorkerEnv };
  return env;
}

function deletionSecret(env: WorkerEnv) {
  return env.FACEBOOK_CLIENT_SECRET?.trim() || "";
}

async function readSignedRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return String(form.get("signed_request") ?? "");
  }
  try {
    const body = (await request.json()) as { signed_request?: unknown };
    return typeof body.signed_request === "string" ? body.signed_request : "";
  } catch {
    return "";
  }
}

async function removeFacebookLink(facebookUserId: string) {
  const db = await getDb();
  await db
    .delete(authAccounts)
    .where(
      and(
        eq(authAccounts.providerId, "facebook"),
        eq(authAccounts.accountId, facebookUserId),
      ),
    );
}

export async function POST(request: Request) {
  const env = await readEnv();
  const secret = deletionSecret(env);
  if (!secret) {
    return Response.json({ error: "facebook_connect_unavailable" }, { status: 503 });
  }

  const signedRequest = await readSignedRequest(request);
  const parsed = parseFacebookSignedRequest(signedRequest, secret);
  if (!parsed) {
    return Response.json({ error: "invalid_signed_request" }, { status: 400 });
  }

  try {
    await removeFacebookLink(parsed.user_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("binding `DB`") || message.includes("no such table")) {
      return Response.json({ error: "registry_unavailable" }, { status: 503 });
    }
    throw error;
  }

  const confirmation = createDeletionConfirmation(Date.now(), secret);
  return Response.json({
    url: deletionStatusUrl(requestOrigin(request), confirmation.confirmationCode),
    confirmation_code: confirmation.confirmationCode,
  });
}

export async function GET(request: Request) {
  const env = await readEnv();
  const secret = deletionSecret(env);
  const code = new URL(request.url).searchParams.get("code");
  const confirmation = verifyDeletionConfirmation(code, secret);
  if (!confirmation) {
    return Response.json({ status: "unknown" }, { status: 404 });
  }
  return Response.json({
    status: "completed",
    confirmation_code: confirmation.confirmationCode,
    issued_at: confirmation.issuedAt,
  });
}
