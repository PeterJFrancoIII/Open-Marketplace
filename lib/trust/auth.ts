/**
 * Server-authenticated request identity via signed session (HMAC cookie).
 * Caller-controlled X-Profile-Id / X-Device-Id alone is rejected for mutations.
 */

import { AuthError } from "./errors.ts";
import {
  readSessionCookie,
  requireSessionSecret,
  verifySessionToken,
} from "./session.ts";

export type ActorRole = "buyer" | "seller" | "stranger" | "moderator";

export type RequestActor = {
  profileId: string;
  isModerator: boolean;
  authMethod: "session";
};

export { AuthError };

/**
 * Resolve the actor from a verified server session only.
 * Header-only identity is intentionally rejected (merge-gate blocker 1).
 */
export async function parseActor(
  request: Request,
  moderatorToken?: string | null,
  sessionSecret?: string | null,
): Promise<RequestActor> {
  const secret = requireSessionSecret(
    sessionSecret ?? process.env.SESSION_SECRET ?? null,
  );
  const token = readSessionCookie(request);
  if (!token) {
    throw new AuthError(
      "Server session required. Call POST /api/auth/session — X-Profile-Id alone is not accepted.",
      401,
    );
  }
  const claims = await verifySessionToken(token, secret);
  const provided = request.headers.get("x-moderator-token")?.trim() ?? "";
  const isModerator = Boolean(
    moderatorToken && provided && provided === moderatorToken,
  );
  return { profileId: claims.profileId, isModerator, authMethod: "session" };
}

/** Sync helper for unit tests that already have a verified profile id. */
export function actorFromProfileId(
  profileId: string,
  isModerator = false,
): RequestActor {
  return { profileId, isModerator, authMethod: "session" };
}

export function roleOnTransaction(
  actor: RequestActor,
  tx: { buyerId: string; sellerId: string },
): ActorRole {
  if (actor.isModerator) return "moderator";
  if (actor.profileId === tx.buyerId) return "buyer";
  if (actor.profileId === tx.sellerId) return "seller";
  return "stranger";
}

export function assertListingOwner(
  actor: RequestActor,
  listing: { sellerId: string },
): void {
  if (actor.isModerator) return;
  if (actor.profileId !== listing.sellerId) {
    throw new AuthError("Only the listing owner may perform this action.", 403);
  }
}

export function assertTransactionParticipant(
  actor: RequestActor,
  tx: { buyerId: string; sellerId: string },
  allowModerator = true,
): ActorRole {
  const role = roleOnTransaction(actor, tx);
  if (role === "stranger") {
    throw new AuthError("Only buyer or seller may access this transaction.", 403);
  }
  if (role === "moderator" && !allowModerator) {
    throw new AuthError("Moderator not permitted for this action.", 403);
  }
  return role;
}
