import { getDb } from "../../../../db";
import {
  acceptSaleEvidence,
  requestAdditionalEvidence,
  updateSaleEvidence,
} from "../../../../lib/conversations";
import {
  conversationError,
  readConversationId,
  requireConversationSession,
} from "../../../../lib/conversation-http";

export async function POST(request: Request) {
  try {
    const { actor, response } = await requireConversationSession(
      request,
      "add sale proof",
    );
    if (!actor) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = readConversationId(payload);
    if (!conversationId) {
      return Response.json({ error: "A conversation id is required." }, { status: 400 });
    }

    const db = await getDb();
    if (payload.action === "accept") {
      const result = await acceptSaleEvidence(db, actor, conversationId, {
        paymentReceipt: payload.paymentReceipt,
        receivedItem: payload.receivedItem,
        receivedPackaging: payload.receivedPackaging,
      });
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      return Response.json({ conversation: result.conversation });
    }
    if (payload.action === "request") {
      const result = await requestAdditionalEvidence(
        db,
        actor,
        conversationId,
        payload.note,
      );
      if (!result.ok) {
        return Response.json({ error: result.error }, { status: result.status });
      }
      return Response.json({ conversation: result.conversation });
    }

    const result = await updateSaleEvidence(db, actor, conversationId, {
      trackingNumber: payload.trackingNumber,
      paymentReceipt: payload.paymentReceipt,
      receivedItem: payload.receivedItem,
      receivedPackaging: payload.receivedPackaging,
      shippedItem: payload.shippedItem,
      shippedPackaging: payload.shippedPackaging,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ conversation: result.conversation });
  } catch (error) {
    return conversationError(error);
  }
}
