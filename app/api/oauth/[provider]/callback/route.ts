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

    // Mock local completion shortcut when ALLOW_MOCK_OAUTH=1 and code is mock:*
    const runtime = await buildRuntimeOAuthService();
    // Recover returnTo from session via complete() path — take happens inside service.
    // Preload existing connection for merge.
    // We need profileId from session; complete() takes session first internally.
    // Load connection after we know profile — complete returns connection.

    // Peek profile by temporarily using complete with null existing, then upsert.
    // For existing connection merge, hydrate after session take... service takes session
    // inside complete, so pass existingConnection only if we know profile.
    // Workaround: complete without existing; if a connection already exists for
    // profile+provider, load it first by parsing nothing — instead load after
    // begin stored profile on session. We need take preview.

    // Simpler: complete with null existingConnection; then if loadConnection finds
    // another row for provider, we still upsert by returned connection id.
    // Prefer merging: take session is inside service. Add optional preload via
    // loading all connections after complete using grant.profileId.

    // Load prior connection if the session profile is already known via grant store
    // after complete; merge ids below.
    const completed = await runtime.service.complete({
      provider: raw,
      code,
      state,
      existingConnection: null,
    });

    const existing = await runtime.loadConnection(completed.grant.profileId, raw);
    const connection = existing
      ? {
          ...completed.connection,
          id: existing.id,
          createdAt: existing.createdAt,
        }
      : completed.connection;

    await runtime.ensureProfile(completed.grant.profileId);
    await runtime.upsertConnection(connection);

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
