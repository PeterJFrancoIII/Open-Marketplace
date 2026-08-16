export type EvidenceExif = {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  dateTimeOriginal?: string;
  orientation?: number;
  width?: number;
  height?: number;
  iso?: number;
  exposureTime?: string;
  fNumber?: string;
  focalLength?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  bitDepth?: number;
};

const JPEG_SOI = 0xffd8;
const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_ORIENTATION = 0x0112;
const TAG_SOFTWARE = 0x0131;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_EXPOSURE = 0x829a;
const TAG_FNUMBER = 0x829d;
const TAG_ISO = 0x8827;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_FOCAL = 0x920a;
const TAG_PIXEL_X = 0xa002;
const TAG_PIXEL_Y = 0xa003;

function readU16(view: DataView, offset: number, little: boolean) {
  return little ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function readU32(view: DataView, offset: number, little: boolean) {
  return little ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

function decodeAscii(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) {
    if (byte === 0) break;
    if (byte >= 32 && byte < 127) text += String.fromCharCode(byte);
  }
  return text.trim();
}

function rational(view: DataView, offset: number, little: boolean) {
  const numerator = readU32(view, offset, little);
  const denominator = readU32(view, offset + 4, little);
  if (!denominator) return null;
  return numerator / denominator;
}

function gpsCoordinate(
  view: DataView,
  offset: number,
  little: boolean,
  ref: string,
) {
  const degrees = rational(view, offset, little);
  const minutes = rational(view, offset + 8, little);
  const seconds = rational(view, offset + 16, little);
  if (degrees == null || minutes == null || seconds == null) return undefined;
  let value = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") value *= -1;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function readIfd(
  view: DataView,
  ifdOffset: number,
  little: boolean,
  exif: EvidenceExif,
  follow = true,
) {
  if (ifdOffset <= 0 || ifdOffset + 2 > view.byteLength) return;
  const count = readU16(view, ifdOffset, little);
  let gpsOffset = 0;
  let exifOffset = 0;
  let latRef = "";
  let lonRef = "";
  let latOffset = 0;
  let lonOffset = 0;
  for (let index = 0; index < count; index += 1) {
    const entry = ifdOffset + 2 + index * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = readU16(view, entry, little);
    const type = readU16(view, entry + 2, little);
    const length = readU32(view, entry + 4, little);
    const valueOffset = readU32(view, entry + 8, little);
    const unit = type === 3 ? 2 : type === 4 || type === 9 ? 4 : type === 5 ? 8 : 1;
    const inline = length * unit <= 4;
    const dataOffset = inline ? entry + 8 : valueOffset;
    if (dataOffset < 0 || dataOffset >= view.byteLength) continue;
    if (tag === TAG_MAKE && type === 2) {
      exif.make = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(length, 64)),
      );
    } else if (tag === TAG_MODEL && type === 2) {
      exif.model = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(length, 64)),
      );
    } else if (tag === TAG_SOFTWARE && type === 2) {
      exif.software = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(length, 80)),
      );
    } else if (tag === TAG_DATETIME && type === 2) {
      exif.dateTime = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(length, 32)),
      );
    } else if (tag === TAG_DATETIME_ORIGINAL && type === 2) {
      exif.dateTimeOriginal = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(length, 32)),
      );
    } else if (tag === TAG_ORIENTATION && (type === 3 || type === 4)) {
      exif.orientation = type === 3 ? readU16(view, dataOffset, little) : valueOffset;
    } else if (tag === TAG_ISO && (type === 3 || type === 4)) {
      exif.iso = type === 3 ? readU16(view, dataOffset, little) : valueOffset;
    } else if (tag === TAG_PIXEL_X && type === 4) {
      exif.width = valueOffset;
    } else if (tag === TAG_PIXEL_Y && type === 4) {
      exif.height = valueOffset;
    } else if (tag === TAG_EXPOSURE && type === 5) {
      const value = rational(view, dataOffset, little);
      if (value) exif.exposureTime = value >= 1 ? `${value}s` : `1/${Math.round(1 / value)}s`;
    } else if (tag === TAG_FNUMBER && type === 5) {
      const value = rational(view, dataOffset, little);
      if (value) exif.fNumber = `f/${Math.round(value * 10) / 10}`;
    } else if (tag === TAG_FOCAL && type === 5) {
      const value = rational(view, dataOffset, little);
      if (value) exif.focalLength = `${Math.round(value)}mm`;
    } else if (tag === TAG_EXIF_IFD && follow) {
      exifOffset = valueOffset;
    } else if (tag === TAG_GPS_IFD && follow) {
      gpsOffset = valueOffset;
    } else if (tag === 0x0001 && type === 2) {
      latRef = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, 2),
      );
    } else if (tag === 0x0003 && type === 2) {
      lonRef = decodeAscii(
        new Uint8Array(view.buffer, view.byteOffset + dataOffset, 2),
      );
    } else if (tag === 0x0002 && type === 5) {
      latOffset = dataOffset;
    } else if (tag === 0x0004 && type === 5) {
      lonOffset = dataOffset;
    }
  }
  if (latOffset && lonOffset) {
    exif.gpsLatitude = gpsCoordinate(view, latOffset, little, latRef || "N");
    exif.gpsLongitude = gpsCoordinate(view, lonOffset, little, lonRef || "E");
  }
  if (follow && exifOffset) readIfd(view, exifOffset, little, exif, false);
  if (follow && gpsOffset) readIfd(view, gpsOffset, little, exif, false);
}

export function readJpegSegments(bytes: Uint8Array) {
  if (bytes.length < 4 || ((bytes[0] << 8) | bytes[1]) !== JPEG_SOI) return [];
  const segments: Array<{ marker: number; data: Uint8Array }> = [];
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = (bytes[offset] << 8) | bytes[offset + 1];
    if (marker === 0xffda || marker === 0xffd9) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) break;
    segments.push({
      marker,
      data: bytes.subarray(offset + 4, offset + 2 + length),
    });
    offset += 2 + length;
  }
  return segments;
}

export function parseJpegExif(bytes: Uint8Array): EvidenceExif {
  const exif: EvidenceExif = { bitDepth: 8 };
  for (const segment of readJpegSegments(bytes)) {
    if (segment.marker !== 0xffe1 || segment.data.length < 14) continue;
    if (decodeAscii(segment.data.subarray(0, 4)) !== "Exif") continue;
    const view = new DataView(
      segment.data.buffer,
      segment.data.byteOffset + 6,
      segment.data.byteLength - 6,
    );
    const little = view.getUint16(0, false) === 0x4949;
    if (!little && view.getUint16(0, false) !== 0x4d4d) continue;
    const ifd0 = readU32(view, 4, little);
    readIfd(view, ifd0, little, exif, true);
  }
  return exif;
}

export function copyJpegMetadata(source: Uint8Array, encoded: Uint8Array) {
  if (encoded.length < 2 || ((encoded[0] << 8) | encoded[1]) !== JPEG_SOI) {
    return encoded;
  }
  const keep = readJpegSegments(source).filter(
    (segment) =>
      segment.marker === 0xffe1 ||
      segment.marker === 0xffe2 ||
      segment.marker === 0xffed,
  );
  if (!keep.length) return encoded;
  const parts = [encoded.subarray(0, 2)];
  for (const segment of keep) {
    const header = new Uint8Array(4);
    header[0] = 0xff;
    header[1] = segment.marker & 0xff;
    const length = segment.data.length + 2;
    header[2] = (length >> 8) & 0xff;
    header[3] = length & 0xff;
    parts.push(header, segment.data);
  }
  parts.push(encoded.subarray(2));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const next = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    next.set(part, offset);
    offset += part.length;
  }
  return next;
}

export function parsePngHeader(bytes: Uint8Array) {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: bytes[24],
  };
}

export function extractEvidenceMetadata(
  bytes: Uint8Array,
  type = "image/jpeg",
): EvidenceExif {
  const normalized = type.toLowerCase();
  if (normalized.includes("png")) {
    const header = parsePngHeader(bytes);
    return {
      width: header?.width,
      height: header?.height,
      bitDepth: header?.bitDepth,
    };
  }
  if (normalized.includes("jpeg") || normalized.includes("jpg") || bytes[0] === 0xff) {
    const exif = parseJpegExif(bytes);
    const sof = readJpegSegments(bytes).find((segment) => segment.marker === 0xffc0);
    if (sof && sof.data.length >= 6) {
      exif.bitDepth = sof.data[0];
      exif.height = (sof.data[1] << 8) | sof.data[2];
      exif.width = (sof.data[3] << 8) | sof.data[4];
    }
    return exif;
  }
  return {};
}

export function buildJpegWithExif(fields: { make?: string; model?: string }) {
  const makeBytes = new TextEncoder().encode(`${fields.make ?? "OpenMarketplace"}\0`);
  const modelBytes = new TextEncoder().encode(`${fields.model ?? "EvidenceCam"}\0`);
  const tiff = new Uint8Array(38 + makeBytes.length + modelBytes.length);
  const view = new DataView(tiff.buffer);
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  view.setUint16(2, 0x002a, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 2, true);
  view.setUint16(10, TAG_MAKE, true);
  view.setUint16(12, 2, true);
  view.setUint32(14, makeBytes.length, true);
  view.setUint32(18, 38, true);
  view.setUint16(22, TAG_MODEL, true);
  view.setUint16(24, 2, true);
  view.setUint32(26, modelBytes.length, true);
  view.setUint32(30, 38 + makeBytes.length, true);
  view.setUint32(34, 0, true);
  tiff.set(makeBytes, 38);
  tiff.set(modelBytes, 38 + makeBytes.length);
  const app1 = new Uint8Array(6 + tiff.length);
  app1.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  app1.set(tiff, 6);
  const rest = Uint8Array.from([
    0xff, 0xdb, 0x00, 0x43, 0x00,
    ...Array.from({ length: 64 }, () => 0x10),
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
  ]);
  const jpeg = new Uint8Array(6 + app1.length + rest.length);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg[2] = 0xff;
  jpeg[3] = 0xe1;
  const length = app1.length + 2;
  jpeg[4] = (length >> 8) & 0xff;
  jpeg[5] = length & 0xff;
  jpeg.set(app1, 6);
  jpeg.set(rest, 6 + app1.length);
  return jpeg;
}

export function sanitizeEvidenceExif(value: unknown): EvidenceExif | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const exif: EvidenceExif = {};
  for (const key of [
    "make",
    "model",
    "software",
    "dateTime",
    "dateTimeOriginal",
    "exposureTime",
    "fNumber",
    "focalLength",
  ] as const) {
    if (typeof row[key] === "string" && row[key].trim()) {
      exif[key] = row[key].trim().slice(0, 80);
    }
  }
  for (const key of ["orientation", "width", "height", "iso", "bitDepth"] as const) {
    const number = Number(row[key]);
    if (Number.isFinite(number) && number > 0) exif[key] = Math.round(number);
  }
  for (const key of ["gpsLatitude", "gpsLongitude"] as const) {
    const number = Number(row[key]);
    if (Number.isFinite(number)) exif[key] = number;
  }
  return Object.keys(exif).length ? exif : null;
}
