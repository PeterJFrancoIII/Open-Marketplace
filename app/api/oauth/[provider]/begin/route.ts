import { OAuthError } from "../../../../../lib/trust/oauth/types.ts";
import {
  assertSameOriginRelativeReturnTo,
  AuthError,
  InvalidTrustTransitionError,
  parseActor,
  rateLimit,
} from "../../../../../lib/trust";
import {
  buildRuntimeOAuthService,
  isSupportedOAuthProvider,
} from "../../../../../lib/trust/oauth/runtime.ts";

type Params = { params: Promise<{ provider: string }> };

function errorResponse(error: unknown) {
  if (
    error instanceof AuthError ||
    error instanceof OAuthError ||
    error instanceof InvalidTrustTransitionError
  ) {
    const status =
      error instanceof InvalidTrustTransitionError ? 422 : error.status;
    return Response.json(
      { error: error.message },
      { status: status ?? 422 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected OAuth error";
  const unavailable =
    message.includes("no such table") ||
    message.includes("binding `DB`") ||
    message.includes("not configured");
  return Response.json(
    { error: unavailable ? "oauth_unavailable" : "oauth_error", message },
    { status: unavailable ? 503 : 500 },
  );
}

export async function POST(request: Request, context: Params) {
  try {
    const { provider: raw } = await context.params;
    if (!isSupportedOAuthProvider(raw)) {
      return Response.json({ error: `Unsupported provider: ${raw}` }, { status: 400 });
    }

    const actor = await parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `oauth:begin:${actor.profileId}:${raw}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      returnTo?: string;
    };
    const url = new URL(request.url);
    const redirectUri = `${url.origin}/api/oauth/${raw}/callback`;
    const returnTo =
      body.returnTo == null || body.returnTo === ""
        ? "/"
        : assertSameOriginRelativeReturnTo(body.returnTo);

    const runtime = await buildRuntimeOAuthService();
    await runtime.ensureProfile(actor.profileId);
    const started = await runtime.service.begin({
      profileId: actor.profileId,
      provider: raw,
      redirectUri,
      returnTo,
    });

    return Response.json({
      provider: raw,
      authorizationUrl: started.authorizationUrl,
      // state stays server-side; do not echo code_verifier
      disclosures: [
        "OAuth proves control of the provider account at connection time.",
        "Link health checks remain a separate signal.",
        "Unavailable provider fields are omitted — never labeled as verified.",
      ],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
