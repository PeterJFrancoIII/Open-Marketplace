import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";
import { AuthError, rateLimit } from "../../../../lib/trust";
import {
  clearSessionCookieHeader,
  mintSessionToken,
  newServerProfileId,
  readSessionCookie,
  requireSessionSecret,
  sessionCookieHeader,
  verifySessionToken,
} from "../../../../lib/trust/session.ts";

function errorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected auth error";
  return Response.json({ error: "auth_error", message }, { status: 500 });
}

/** Resume an existing session or report unauthenticated. */
export async function GET(request: Request) {
  try {
    const secret = requireSessionSecret(process.env.SESSION_SECRET);
    const token = readSessionCookie(request);
    if (!token) {
      return Response.json({ authenticated: false }, { status: 401 });
    }
    const claims = await verifySessionToken(token, secret);
    return Response.json({
      authenticated: true,
      profileId: claims.profileId,
      expiresAt: new Date(claims.expiresAt).toISOString(),
      disclosures: [
        "Identity comes from a server-signed HttpOnly session cookie.",
        "X-Profile-Id / X-Device-Id alone cannot authorize mutations.",
      ],
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Mint a new server-authenticated device session.
 * Profile ids are assigned by the server — clients cannot choose another user's id.
 */
export async function POST(request: Request) {
  try {
    const secret = requireSessionSecret(process.env.SESSION_SECRET);
    const limited = rateLimit({
      key: `auth:session:${request.headers.get("cf-connecting-ip") ?? "anon"}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Refresh existing valid session instead of minting a new profile.
    const existing = readSessionCookie(request);
    if (existing) {
      try {
        const claims = await verifySessionToken(existing, secret);
        const token = await mintSessionToken(claims.profileId, secret);
        return Response.json(
          {
            authenticated: true,
            profileId: claims.profileId,
            refreshed: true,
          },
          { headers: { "set-cookie": sessionCookieHeader(token) } },
        );
      } catch {
        // fall through to mint
      }
    }

    const profileId = newServerProfileId();
    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db
      .insert(profiles)
      .values({
        id: profileId,
        displayName: `Seller ${profileId.slice(-8)}`,
        updatedAt,
      })
      .onConflictDoUpdate({ target: profiles.id, set: { updatedAt } });

    const token = await mintSessionToken(profileId, secret);
    return Response.json(
      {
        authenticated: true,
        profileId,
        refreshed: false,
        disclosures: [
          "This session binds a server-issued profile id.",
          "Protected marketplace mutations require this cookie.",
        ],
      },
      { status: 201, headers: { "set-cookie": sessionCookieHeader(token) } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  return Response.json(
    { authenticated: false },
    { headers: { "set-cookie": clearSessionCookieHeader() } },
  );
}
