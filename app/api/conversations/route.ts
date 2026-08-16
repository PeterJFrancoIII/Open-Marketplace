import { getDb } from "../../../db";
import {
  listConversations,
  listMessages,
  startConversation,
} from "../../../lib/conversations";
import {
  conversationError,
  requireConversationSession,
} from "../../../lib/conversation-http";

export async function GET(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "open messages",
    );
    if (!actor) return response;

    const conversationId =
      new URL(request.url).searchParams.get("id")?.trim().slice(0, 80) ?? "";
    const db = await getDb();
    if (conversationId) {
      const thread = await listMessages(db, conversationId, actor.id);
      if (!thread) {
        return Response.json({ error: "Conversation not found." }, { status: 404 });
      }
      return Response.json(thread);
    }

    return Response.json({
      conversations: await listConversations(db, actor.id),
    });
  } catch (error) {
    return conversationError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "message a seller",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const listingId =
      typeof payload.listingId === "string" ? payload.listingId.trim().slice(0, 80) : "";
    if (!listingId) {
      return Response.json({ error: "A listing id is required." }, { status: 400 });
    }

    const result = await startConversation(await getDb(), actor, listingId);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(
      { conversation: result.conversation },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return conversationError(error);
  }
}

