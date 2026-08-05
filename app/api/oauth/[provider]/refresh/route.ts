import {
  AuthError,
  OAuthError,
  parseActor,
  rateLimit,
} from "../../../../../lib/trust";
import {
  buildRuntimeOAuthService,
  isSupportedOAuthProvider,
} from "../../../../../lib/trust/oauth/runtime.ts";

type Params = { params: Promise<{ provider: string }> };

function errorResponse(error: unknown) {
  if (error instanceof AuthError || error instanceof OAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected OAuth error";
  return Response.json({ error: "oauth_error", message }, { status: 500 });
}

export async function POST(request: Request, context: Params) {
  try {
    const { provider: raw } = await context.params;
    if (!isSupportedOAuthProvider(raw)) {
      return Response.json({ error: `Unsupported provider: ${raw}` }, { status: 400 });
    }
    const actor = parseActor(request, process.env.MODERATOR_TOKEN ?? null);
    const limited = rateLimit({
      key: `oauth:refresh:${actor.profileId}:${raw}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const runtime = await buildRuntimeOAuthService();
    const existing = await runtime.loadConnection(actor.profileId, raw);
    if (!existing) {
      return Response.json({ error: "No social connection for provider" }, { status: 404 });
    }

    const result = await runtime.service.refresh({
      profileId: actor.profileId,
      provider: raw,
      connection: existing,
    });
    await runtime.upsertConnection(result.connection);

    return Response.json({
      provider: raw,
      grant: result.grant,
      connection: {
        id: result.connection.id,
        provider: result.connection.provider,
        status: result.connection.status,
        canonicalUrl: result.connection.canonicalUrl,
        handle: result.connection.handle,
        accountCreatedAt: result.connection.accountCreatedAt,
        accountCreatedAtSource: result.connection.accountCreatedAtSource,
        connectionCount: result.connection.connectionCount,
        connectionCountSource: result.connection.connectionCountSource,
        lastSuccessfulRefreshAt: result.connection.lastSuccessfulRefreshAt,
      },
      claimsOmitted: result.claimsOmitted,
      disclosures: [
        "Only fields returned by the provider are marked provider-sourced.",
        "Omitted fields are not shown as verified.",
      ],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
