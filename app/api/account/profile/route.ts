import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";
import {
  getFacebookConnection,
  getMarketplaceSession,
} from "../../../../lib/auth";
import { getPayPalConnection } from "../../../../lib/paypal-connect";
import { mergePaymentDestinationsForSave } from "../../../../lib/paypal-public";
import {
  PAYMENT_RAILS,
  normalizePaymentDestinations,
  parsePaymentDestinationsJson,
} from "../../../../lib/payment-destinations";
import {
  SHIPPING_BROKERS,
  normalizeShippingBrokers,
  parseShippingBrokersJson,
  serializePaymentBundle,
} from "../../../../lib/shipping-brokers";
import {
  mergeSocialAccountsForSave,
  normalizeSocialAccountsForProfile,
  parseSocialAccountsJson,
} from "../../../../lib/profile-settings";

function registryError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected registry error";
  const unavailable = message.includes("no such table") || message.includes("binding `DB`");
  return Response.json(
    {
      error: unavailable ? "registry_unavailable" : "registry_error",
      message: unavailable
        ? "The metadata registry is not initialized yet."
        : "The metadata registry could not complete this request.",
    },
    { status: unavailable ? 503 : 500 },
  );
}

async function requireSession(request: Request) {
  const session = await getMarketplaceSession(request);
  if (!session) {
    return {
      session: null,
      response: Response.json(
        { error: "Log in to manage account settings." },
        { status: 401 },
      ),
    };
  }
  return { session, response: null };
}

async function profilePayload(
  request: Request,
  socialAccountsJson: string | null | undefined,
  paymentDestinationsJson: string | null | undefined,
) {
  return {
    socialAccounts: parseSocialAccountsJson(socialAccountsJson),
    paymentDestinations: parsePaymentDestinationsJson(paymentDestinationsJson),
    shippingBrokers: parseShippingBrokersJson(paymentDestinationsJson),
    allowedPaymentRails: PAYMENT_RAILS,
    allowedShippingBrokers: SHIPPING_BROKERS,
    facebookConnection: await getFacebookConnection(request),
    paypalConnection: await getPayPalConnection(request),
  };
}

export async function GET(request: Request) {
  try {
    const { session, response } = await requireSession(request);
    if (!session) return response;

    const db = await getDb();
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1);

    return Response.json(
      await profilePayload(
        request,
        profile?.socialAccountsJson,
        profile?.paymentDestinationsJson,
      ),
    );
  } catch (error) {
    return registryError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { session, response } = await requireSession(request);
    if (!session) return response;

    const payload = (await request.json()) as Record<string, unknown>;
    const hasSocial = Object.prototype.hasOwnProperty.call(payload, "socialAccounts");
    const hasPayment = Object.prototype.hasOwnProperty.call(
      payload,
      "paymentDestinations",
    );
    const hasShipping = Object.prototype.hasOwnProperty.call(
      payload,
      "shippingBrokers",
    );
    if (!hasSocial && !hasPayment && !hasShipping) {
      return Response.json(
        {
          error:
            "Provide socialAccounts, paymentDestinations, or shippingBrokers to update.",
        },
        { status: 400 },
      );
    }

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, session.user.id))
      .limit(1);

    let nextSocialJson: string | undefined;
    let nextSocialAccounts;
    if (hasSocial) {
      const normalized = await normalizeSocialAccountsForProfile(payload.socialAccounts);
      if (!normalized.ok) {
        return Response.json(
          { error: normalized.error, account: normalized.account },
          { status: 422 },
        );
      }
      const facebookConnection = await getFacebookConnection(request);
      const [fresh] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, session.user.id))
        .limit(1);
      const existingSocial = parseSocialAccountsJson(
        fresh?.socialAccountsJson ?? existing?.socialAccountsJson,
      );
      nextSocialAccounts = mergeSocialAccountsForSave(
        normalized.accounts,
        existingSocial,
        facebookConnection.connected,
      );
      nextSocialJson = JSON.stringify(nextSocialAccounts);
    }

    const existingDestinations = parsePaymentDestinationsJson(
      existing?.paymentDestinationsJson,
    );
    const existingBrokers = parseShippingBrokersJson(
      existing?.paymentDestinationsJson,
    );
    let nextPaymentDestinations = existingDestinations;
    let nextShippingBrokers = existingBrokers;
    if (hasPayment) {
      const normalized = normalizePaymentDestinations(payload.paymentDestinations);
      if (!normalized.ok) {
        return Response.json({ error: normalized.error }, { status: 400 });
      }
      const paypalConnection = await getPayPalConnection(request);
      nextPaymentDestinations = mergePaymentDestinationsForSave(
        normalized.destinations,
        existingDestinations,
        paypalConnection.connected,
      );
    }
    if (hasShipping) {
      const normalized = normalizeShippingBrokers(payload.shippingBrokers);
      if (!normalized.ok) {
        return Response.json({ error: normalized.error }, { status: 400 });
      }
      nextShippingBrokers = normalized.brokers;
    }
    const nextPaymentJson =
      hasPayment || hasShipping
        ? serializePaymentBundle(nextPaymentDestinations, nextShippingBrokers)
        : undefined;
    const updatedAt = new Date().toISOString();
    const socialAccountsJson =
      nextSocialJson ?? existing?.socialAccountsJson ?? "[]";
    const paymentDestinationsJson =
      nextPaymentJson ?? existing?.paymentDestinationsJson ?? "[]";

    await db
      .insert(profiles)
      .values({
        id: session.user.id,
        displayName: session.user.name,
        socialAccountsJson,
        paymentDestinationsJson,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          displayName: session.user.name,
          socialAccountsJson,
          paymentDestinationsJson,
          updatedAt,
        },
      });

    return Response.json({
      socialAccounts:
        nextSocialAccounts ?? parseSocialAccountsJson(existing?.socialAccountsJson),
      paymentDestinations: nextPaymentDestinations,
      shippingBrokers: nextShippingBrokers,
      allowedPaymentRails: PAYMENT_RAILS,
      allowedShippingBrokers: SHIPPING_BROKERS,
      facebookConnection: await getFacebookConnection(request),
      paypalConnection: await getPayPalConnection(request),
    });
  } catch (error) {
    return registryError(error);
  }
}
