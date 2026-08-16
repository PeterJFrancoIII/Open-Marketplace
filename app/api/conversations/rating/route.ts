import { getDb } from "../../../../db";
import { submitRating } from "../../../../lib/conversations";
import {
  conversationError,
  readConversationId,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "rate this sale",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = readConversationId(payload);
    const score = Number(payload.score);
    const note = typeof payload.note === "string" ? payload.note : "";
    if (!conversationId) {
      return Response.json({ error: "A conversation id is required." }, { status: 400 });
    }

    const result = await submitRating(
      await getDb(),
      actor,
      conversationId,
      score,
      note,
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ conversation: result.conversation });
  } catch (error) {
    return conversationError(error);
  }
}
