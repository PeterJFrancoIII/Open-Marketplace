import {
  inchesToCm,
  parcelMonkeyCalculatorUrl,
  pirateShipCalculatorUrl,
  poundsToKg,
  type ShippingPackage,
} from "./shipping-package";

export type ShippingQuote = {
  provider: "parcel_monkey";
  carrier: string;
  serviceName: string;
  description: string;
  totalPrice: string;
  currency: "GBP";
};

type ParcelMonkeyQuote = {
  carrier?: string;
  service_name?: string;
  service_description?: string;
  total_price_gross?: string | number;
};

export function parcelMonkeyConfigured(
  userId?: string | null,
  token?: string | null,
) {
  return Boolean(userId?.trim() && token?.trim());
}

export async function fetchParcelMonkeyQuotes(
  shippingPackage: ShippingPackage,
  userId: string,
  token: string,
  goodsValueGbp: number,
): Promise<ShippingQuote[]> {
  const response = await fetch("https://api.parcelmonkey.co.uk/GetQuote", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      apiversion: "3.1",
      userid: userId,
      token,
    },
    body: JSON.stringify({
      origin: shippingPackage.originCountry,
      destination: shippingPackage.destCountry,
      boxes: [
        {
          length: inchesToCm(shippingPackage.lengthIn),
          width: inchesToCm(shippingPackage.widthIn),
          height: inchesToCm(shippingPackage.heightIn),
          weight: poundsToKg(shippingPackage.weightLb),
        },
      ],
      goods_value: goodsValueGbp,
      sender: {
        name: "Seller",
        address1: "Shipping estimate",
        town: "Origin",
        county: shippingPackage.originCountry,
        postcode: shippingPackage.originPostal,
      },
      recipient: {
        name: "Buyer",
        address1: "Shipping estimate",
        town: "Destination",
        county: shippingPackage.destCountry,
        postcode: shippingPackage.destPostal,
      },
    }),
  });
  if (!response.ok) {
    throw new Error("Parcel Monkey could not return quotes for that package.");
  }
  const payload = (await response.json()) as ParcelMonkeyQuote[] | { error?: string };
  if (!Array.isArray(payload)) {
    throw new Error(payload.error || "Parcel Monkey did not return quotes.");
  }
  return payload.slice(0, 8).map((quote) => ({
    provider: "parcel_monkey" as const,
    carrier: String(quote.carrier ?? "Parcel Monkey"),
    serviceName: String(quote.service_name ?? "Service"),
    description: String(quote.service_description ?? ""),
    totalPrice: String(quote.total_price_gross ?? ""),
    currency: "GBP" as const,
  }));
}

export function shippingQuoteLinks() {
  return {
    pirateShipUrl: pirateShipCalculatorUrl(),
    parcelMonkeyCalculatorUrl: parcelMonkeyCalculatorUrl(),
  };
}
