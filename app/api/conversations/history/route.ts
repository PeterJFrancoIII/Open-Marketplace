import { getDb } from "../../../../db";
import { listSaleHistory } from "../../../../lib/conversations";
import {
  conversationError,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function GET(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "view sale history",
    );
    if (!actor) return response;

    return Response.json({
      history: await listSaleHistory(await getDb(), actor.id),
    });
  } catch (error) {
    return conversationError(error);
  }
}
