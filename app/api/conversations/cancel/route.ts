import { getDb } from "../../../../db";
import { cancelConversation } from "../../../../lib/conversations";
import {
  conversationError,
  readConversationId,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "cancel this transaction",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = readConversationId(payload);
    if (!conversationId) {
      return Response.json({ error: "A conversation id is required." }, { status: 400 });
    }

    const action =
      payload.action === undefined || payload.action === "request"
        ? "request"
        : payload.action === "withdraw"
          ? "withdraw"
          : null;
    if (!action) {
      return Response.json(
        { error: "Choose request or withdraw." },
        { status: 400 },
      );
    }

    const result = await cancelConversation(
      await getDb(),
      actor,
      conversationId,
      action,
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    if (result.deleted) {
      return Response.json({ deleted: true });
    }
    return Response.json({ conversation: result.conversation, deleted: false });
  } catch (error) {
    return conversationError(error);
  }
}
