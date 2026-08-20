import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";
import { getMarketplaceSession } from "../../../../lib/auth";
import {
  normalizePaymentDestinations,
  parsePaymentDestinationsJson,
} from "../../../../lib/payment-destinations";
import {
  getPayPalConnection,
  replacePaypalDestination,
} from "../../../../lib/paypal-connect";

export async function POST(request: Request) {
  const session = await getMarketplaceSession(request);
  if (!session?.user.id) {
    return Response.json(
      { error: "Log in to connect PayPal." },
      { status: 401 },
    );
  }

  let destination = "";
  try {
    const body = (await request.json()) as { destination?: unknown };
    destination = typeof body.destination === "string" ? body.destination : "";
  } catch {
    return Response.json(
      { error: "Enter your public PayPal email or paypal.me link." },
      { status: 400 },
    );
  }

  const normalized = normalizePaymentDestinations([
    { rail: "paypal", destination },
  ]);
  if (!normalized.ok) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }
  const paypal = normalized.destinations.find((item) => item.rail === "paypal");
  if (!paypal) {
    return Response.json(
      { error: "Enter your public PayPal email or paypal.me link." },
      { status: 400 },
    );
  }

  await replacePaypalDestination(
    session.user.id,
    session.user.name?.trim() || paypal.destination,
    paypal,
  );

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
