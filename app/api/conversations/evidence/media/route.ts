import { getDb } from "../../../../../db";
import { getConversationMedia } from "../../../../../lib/conversations";
import {
  conversationError,
  requireConversationSession,
} from "../../../../../lib/conversation-http";

export async function GET(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "view sale proof",
    );
    if (!actor) return response;

    const url = new URL(request.url);
    const conversationId = url.searchParams.get("conversationId")?.trim() ?? "";
    const hash = url.searchParams.get("hash")?.trim() ?? "";
    if (!conversationId || !hash) {
      return Response.json(
        { error: "A conversation id and photo hash are required." },
        { status: 400 },
      );
    }

    const result = await getConversationMedia(
      await getDb(),
      actor,
      conversationId,
      hash,
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return new Response(result.bytes, {
      headers: {
        "content-type": result.type,
        "content-disposition": `inline; filename="${result.name.replace(/"/g, "")}"`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (error) {
    return conversationError(error);
  }
}
