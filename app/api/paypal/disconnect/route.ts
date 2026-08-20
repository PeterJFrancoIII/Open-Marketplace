import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";
import { getMarketplaceSession } from "../../../../lib/auth";
import { parsePaymentDestinationsJson } from "../../../../lib/payment-destinations";
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
  const db = await getDb();
  const [profile] = await db
    .select({ paymentDestinationsJson: profiles.paymentDestinationsJson })
    .from(profiles)
    .where(eq(profiles.id, session.user.id))
    .limit(1);
  return Response.json({
    paypalConnection: await getPayPalConnection(request),
    paymentDestinations: parsePaymentDestinationsJson(
      profile?.paymentDestinationsJson,
    ),
  });
}
