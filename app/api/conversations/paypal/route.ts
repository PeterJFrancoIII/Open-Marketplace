import { getDb } from "../../../../db";
import { updatePaypalSale } from "../../../../lib/conversations";
import {
  conversationError,
  readConversationId,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "update this PayPal sale",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = readConversationId(payload);
    if (!conversationId) {
      return Response.json({ error: "A conversation id is required." }, { status: 400 });
    }

    const salePriceCents =
      payload.salePriceCents === undefined
        ? undefined
        : Number(payload.salePriceCents);
    const buyerMarksSafe =
      payload.buyerMarksSafe === undefined
        ? undefined
        : Boolean(payload.buyerMarksSafe);

    const result = await updatePaypalSale(await getDb(), actor, conversationId, {
      salePriceCents,
      buyerMarksSafe,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ conversation: result.conversation });
  } catch (error) {
    return conversationError(error);
  }
}
