import { getMarketplaceSession } from "../../../../lib/auth";
import {
  fetchParcelMonkeyQuotes,
  parcelMonkeyConfigured,
  shippingQuoteLinks,
} from "../../../../lib/parcel-monkey";
import { normalizeShippingPackage } from "../../../../lib/shipping-package";

async function readWorkerEnv() {
  const { env } = await import("cloudflare:workers");
  return env as {
    PARCEL_MONKEY_USER_ID?: string;
    PARCEL_MONKEY_API_TOKEN?: string;
  };
}

export async function POST(request: Request) {
  const session = await getMarketplaceSession(request);
  if (!session) {
    return Response.json(
      { error: "Log in to request shipping estimates." },
      { status: 401 },
    );
  }

  const payload = (await request.json()) as Record<string, unknown>;
  const normalized = normalizeShippingPackage(payload.package ?? payload);
  if (!normalized.ok) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const links = shippingQuoteLinks();
  const env = await readWorkerEnv();
  const userId = env.PARCEL_MONKEY_USER_ID?.trim();
  const token = env.PARCEL_MONKEY_API_TOKEN?.trim();
  if (!parcelMonkeyConfigured(userId, token)) {
    return Response.json({
      available: false,
      quotes: [],
      message:
        "Live Parcel Monkey quotes are not configured. Use the official calculators with the size you entered.",
      ...links,
    });
  }

  const goodsValueGbp = Math.max(
    1,
    Math.round(Number(payload.goodsValueUsd ?? 0) * 0.78) || 1,
  );
  try {
    const quotes = await fetchParcelMonkeyQuotes(
      normalized.package,
      userId!,
      token!,
      goodsValueGbp,
    );
    return Response.json({
      available: true,
      quotes,
      message: "Estimates are from Parcel Monkey and are not a booking.",
      ...links,
    });
  } catch (error) {
    return Response.json(
      {
        available: false,
        quotes: [],
        error:
          error instanceof Error
            ? error.message
            : "Parcel Monkey could not return quotes.",
        ...links,
      },
      { status: 502 },
    );
  }
}
