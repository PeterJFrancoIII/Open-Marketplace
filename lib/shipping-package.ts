export type ShippingPackage = {
  weightLb: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  originPostal: string;
  originCountry: string;
  destPostal: string;
  destCountry: string;
};

const PACKAGE_MARKER = "\n\nOM_PACKAGE:";
const POSTAL = /^[A-Z0-9][A-Z0-9\s-]{1,12}$/i;
const COUNTRY = /^[A-Z]{2}$/;

function boundedNumber(value: unknown, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < minimum || parsed > maximum) return null;
  return parsed;
}

export function normalizeShippingPackage(input: unknown):
  | { ok: true; package: ShippingPackage }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Enter package size and postal codes for a quote." };
  }
  const record = input as Record<string, unknown>;
  const weightLb = boundedNumber(record.weightLb, 0.1, 70);
  const lengthIn = boundedNumber(record.lengthIn, 1, 80);
  const widthIn = boundedNumber(record.widthIn, 1, 80);
  const heightIn = boundedNumber(record.heightIn, 1, 80);
  const originPostal = String(record.originPostal ?? "").trim().toUpperCase();
  const destPostal = String(record.destPostal ?? "").trim().toUpperCase();
  const originCountry = String(record.originCountry ?? "US").trim().toUpperCase();
  const destCountry = String(record.destCountry ?? "US").trim().toUpperCase();
  if (!weightLb || !lengthIn || !widthIn || !heightIn) {
    return { ok: false, error: "Weight and box size are required for shipping estimates." };
  }
  if (!POSTAL.test(originPostal) || !POSTAL.test(destPostal)) {
    return { ok: false, error: "Origin and destination postal codes are required." };
  }
  if (!COUNTRY.test(originCountry) || !COUNTRY.test(destCountry)) {
    return { ok: false, error: "Use two-letter country codes such as US or GB." };
  }
  return {
    ok: true,
    package: {
      weightLb,
      lengthIn,
      widthIn,
      heightIn,
      originPostal,
      originCountry,
      destPostal,
      destCountry,
    },
  };
}

export function inchesToCm(inches: number) {
  return Math.max(1, Math.round(inches * 2.54));
}

export function poundsToKg(pounds: number) {
  return Math.max(0.1, Math.round(pounds * 0.453592 * 10) / 10);
}

export function pirateShipCalculatorUrl() {
  return "https://www.pirateship.com/ship";
}

export function parcelMonkeyCalculatorUrl() {
  return "https://www.parcelmonkey.com/shipping-calculator";
}

export function stripPackageFromDescription(description: string) {
  const index = description.lastIndexOf(PACKAGE_MARKER);
  if (index < 0) {
    return { description, package: null as ShippingPackage | null };
  }
  const raw = description.slice(index + PACKAGE_MARKER.length).trim();
  const parsed = normalizeShippingPackage(safeJson(raw));
  return {
    description: description.slice(0, index).trimEnd(),
    package: parsed.ok ? parsed.package : null,
  };
}

export function attachPackageToDescription(
  description: string,
  shippingPackage: ShippingPackage | null,
) {
  const clean = stripPackageFromDescription(description).description;
  if (!shippingPackage) return clean;
  return `${clean}${PACKAGE_MARKER}${JSON.stringify(shippingPackage)}`;
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
