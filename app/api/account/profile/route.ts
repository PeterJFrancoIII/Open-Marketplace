import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { profiles } from "../../../../db/schema";
import {
  getFacebookConnection,
  getMarketplaceSession,
} from "../../../../lib/auth";
import {
  PAYMENT_RAILS,
  normalizePaymentDestinations,
  parsePaymentDestinationsJson,
} from "../../../../lib/payment-destinations";
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
    allowedPaymentRails: PAYMENT_RAILS,
    facebookConnection: await getFacebookConnection(request),
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
    if (!hasSocial && !hasPayment) {
      return Response.json(
        { error: "Provide socialAccounts or paymentDestinations to update." },
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
      const existingSocial = parseSocialAccountsJson(existing?.socialAccountsJson);
      nextSocialAccounts = mergeSocialAccountsForSave(
        normalized.accounts,
        existingSocial,
      );
      nextSocialJson = JSON.stringify(nextSocialAccounts);
    }

    let nextPaymentJson: string | undefined;
    let nextPaymentDestinations;
    if (hasPayment) {
      const normalized = normalizePaymentDestinations(payload.paymentDestinations);
      if (!normalized.ok) {
        return Response.json({ error: normalized.error }, { status: 400 });
      }
      nextPaymentDestinations = normalized.destinations;
      nextPaymentJson = JSON.stringify(normalized.destinations);
    }
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
      paymentDestinations:
        nextPaymentDestinations ??
        parsePaymentDestinationsJson(existing?.paymentDestinationsJson),
      allowedPaymentRails: PAYMENT_RAILS,
      facebookConnection: await getFacebookConnection(request),
    });
  } catch (error) {
    return registryError(error);
  }
}
