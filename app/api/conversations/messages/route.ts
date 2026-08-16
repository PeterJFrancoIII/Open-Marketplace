import { getDb } from "../../../../db";
import { sendMessage } from "../../../../lib/conversations";
import {
  conversationError,
  readConversationId,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "send a message",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = readConversationId(payload);
    const body = typeof payload.body === "string" ? payload.body : "";
    if (!conversationId) {
      return Response.json({ error: "A conversation id is required." }, { status: 400 });
    }

    const result = await sendMessage(await getDb(), actor, conversationId, body);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ message: result.message }, { status: 201 });
  } catch (error) {
    return conversationError(error);
  }
}
