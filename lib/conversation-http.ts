import { getMarketplaceSession } from "./auth";
import type { ConversationActor } from "./conversations";

export async function requireConversationSession(
  request: Request,
  action: string,
) {
  const session = await getMarketplaceSession(request);
  if (!session?.user.id) {
    return {
      actor: null as ConversationActor | null,
      response: Response.json(
        { error: `Log in to ${action}.` },
        { status: 401 },
      ),
    };
  }
  return {
    actor: {
      id: session.user.id,
      name: session.user.name?.trim() || "Marketplace user",
    },
    response: null,
  };
}

export function conversationError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected conversation error";
  const unavailable = message.includes("no such table") || message.includes("binding `DB`");
  return Response.json(
    {
      error: unavailable ? "registry_unavailable" : "conversation_error",
      message: unavailable
        ? "The metadata registry is not initialized yet."
        : "The conversation request could not be completed.",
    },
    { status: unavailable ? 503 : 500 },
  );
}

export function readConversationId(payload: Record<string, unknown>) {
  return typeof payload.conversationId === "string"
    ? payload.conversationId.trim().slice(0, 80)
    : "";
}
