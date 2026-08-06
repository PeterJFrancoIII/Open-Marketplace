import { OAuthError } from "../../../../../lib/trust";
import {
  buildRuntimeOAuthService,
  isSupportedOAuthProvider,
} from "../../../../../lib/trust/oauth/runtime.ts";

type Params = { params: Promise<{ provider: string }> };

function redirectWithError(origin: string, message: string) {
  const target = new URL("/", origin);
  target.searchParams.set("oauth_error", message.slice(0, 180));
  return Response.redirect(target.toString(), 302);
}

export async function GET(request: Request, context: Params) {
  const url = new URL(request.url);
  try {
    const { provider: raw } = await context.params;
    if (!isSupportedOAuthProvider(raw)) {
      return redirectWithError(url.origin, `Unsupported provider: ${raw}`);
    }

    const code = url.searchParams.get("code")?.trim() ?? "";
    const state = url.searchParams.get("state")?.trim() ?? "";
    const providerError = url.searchParams.get("error");
    if (providerError) {
      return redirectWithError(
        url.origin,
        url.searchParams.get("error_description") || providerError,
      );
    }
    if (!code || !state) {
      return redirectWithError(url.origin, "Missing OAuth code or state");
    }

    const runtime = await buildRuntimeOAuthService();
    const session = await runtime.peekSession(state);
    const existing = session
      ? await runtime.loadConnection(session.profileId, raw)
      : null;

    // Atomically persists provider grant + social_connection (+ profile ensure).
    const completed = await runtime.service.complete({
      provider: raw,
      code,
      state,
      existingConnection: existing,
    });

    await runtime.syncProfileSocialAccounts(completed.grant.profileId);

    const returnPath = completed.returnTo.startsWith("/") ? completed.returnTo : "/";
    const returnTarget = new URL(returnPath, url.origin);
    returnTarget.searchParams.set("oauth", "connected");
    returnTarget.searchParams.set("provider", raw);
    if (completed.claimsOmitted.length) {
      returnTarget.searchParams.set("omitted", completed.claimsOmitted.join(","));
    }
    return Response.redirect(returnTarget.toString(), 302);
  } catch (error) {
    const message =
      error instanceof OAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "OAuth callback failed";
    return redirectWithError(url.origin, message);
  }
}
