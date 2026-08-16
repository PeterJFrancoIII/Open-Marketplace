import { getMarketplaceSession } from "../../../../lib/auth";
import {
  clearPaypalPaymentDestination,
  deletePaypalAccount,
  getPayPalConnection,
} from "../../../../lib/paypal-connect";

export async function POST(request: Request) {
  const session = await getMarketplaceSession(request);
  if (!session?.user.id) {
    return Response.json(
      { error: "Log in to disconnect PayPal." },
      { status: 401 },
    );
  }
  await deletePaypalAccount(session.user.id);
  await clearPaypalPaymentDestination(session.user.id);
  return Response.json({
    paypalConnection: await getPayPalConnection(request),
  });
}
