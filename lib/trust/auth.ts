/**
 * Interim A0 request identity (device/profile header).
 * Passkeys / OIDC (assurance A1+) arrive in later PRs. Do not treat this as
 * strong authentication — it enforces ownership boundaries for the lifecycle API.
 */

export type ActorRole = "buyer" | "seller" | "stranger" | "moderator";

export type RequestActor = {
  profileId: string;
  isModerator: boolean;
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function parseActor(request: Request, moderatorToken?: string | null): RequestActor {
  const profileId =
    request.headers.get("x-profile-id")?.trim() ||
    request.headers.get("x-device-id")?.trim() ||
    "";
  if (!profileId || profileId.length < 8 || profileId.length > 120) {
    throw new AuthError("Authenticated profile id required (X-Profile-Id).");
  }
  const provided = request.headers.get("x-moderator-token")?.trim() ?? "";
  const isModerator = Boolean(
    moderatorToken && provided && provided === moderatorToken,
  );
  return { profileId, isModerator };
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
