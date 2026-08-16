import { getDb } from "../../../../db";
import { setSaleStatus } from "../../../../lib/conversations";
import { isSaleStatus } from "../../../../lib/conversation-limits";
import {
  conversationError,
  readConversationId,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "update this sale",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = readConversationId(payload);
    if (!conversationId) {
      return Response.json({ error: "A conversation id is required." }, { status: 400 });
    }
    if (!isSaleStatus(payload.status)) {
      return Response.json(
        { error: "Choose Pending, In-Transfer, or Complete." },
        { status: 400 },
      );
    }

    const result = await setSaleStatus(
      await getDb(),
      actor,
      conversationId,
      payload.status,
      {
        trackingNumber: payload.trackingNumber,
        paymentReceipt: payload.paymentReceipt,
        receivedItem: payload.receivedItem,
        receivedPackaging: payload.receivedPackaging,
        shippedItem: payload.shippedItem,
        shippedPackaging: payload.shippedPackaging,
      },
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ conversation: result.conversation });
  } catch (error) {
    return conversationError(error);
  }
}
