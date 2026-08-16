import {
  EVIDENCE_ARCHIVE_MAX_EDGE,
  EVIDENCE_ARCHIVE_QUALITY,
  EVIDENCE_FULL_QUALITY,
  EVIDENCE_MAX_BIT_DEPTH,
  EVIDENCE_MAX_HEIGHT,
  EVIDENCE_MAX_WIDTH,
  EVIDENCE_PHOTO_STORE_MAX_BYTES,
} from "./evidence-limits.ts";
import {
  copyJpegMetadata,
  extractEvidenceMetadata,
  type EvidenceExif,
} from "./exif-jpeg.ts";

export {
  EVIDENCE_ARCHIVE_AFTER_MS,
  EVIDENCE_ARCHIVE_MAX_EDGE,
  EVIDENCE_ARCHIVE_QUALITY,
  EVIDENCE_FULL_QUALITY,
  EVIDENCE_MAX_BIT_DEPTH,
  EVIDENCE_MAX_HEIGHT,
  EVIDENCE_MAX_WIDTH,
  EVIDENCE_PHOTOS_PER_KIND,
  EVIDENCE_PHOTO_STORE_MAX_BYTES,
} from "./evidence-limits.ts";

export { evidenceArchiveDue } from "./evidence-limits.ts";

export type EvidenceEncodeMode = "full" | "archival";

export type PreparedEvidence = {
  file: File;
  bytes: Uint8Array;
  exif: EvidenceExif;
  width?: number;
  height?: number;
  quality: EvidenceEncodeMode;
  encoded: boolean;
};

function isPdf(file: File) {
  return (
    file.type.toLowerCase() === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function evidenceNeedsEncode(
  file: File,
  meta: EvidenceExif,
  mode: EvidenceEncodeMode = "full",
) {
  if (isPdf(file)) return file.size > EVIDENCE_PHOTO_STORE_MAX_BYTES;
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const bitDepth = meta.bitDepth ?? 8;
  if (mode === "archival") return true;
  return (
    width > EVIDENCE_MAX_WIDTH ||
    height > EVIDENCE_MAX_HEIGHT ||
    bitDepth > EVIDENCE_MAX_BIT_DEPTH ||
    file.size > EVIDENCE_PHOTO_STORE_MAX_BYTES
  );
}

function scaleSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function canvasToJpeg(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
) {
  const canvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in context) {
    context.imageSmoothingQuality = "high";
  }
  context.drawImage(bitmap, 0, 0, width, height);
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise<Blob | null>((resolve) => {
    (canvas as HTMLCanvasElement).toBlob(resolve, "image/jpeg", quality);
  });
}

async function encodeWithSystemCodec(
  file: File,
  sourceBytes: Uint8Array,
  mode: EvidenceEncodeMode,
): Promise<File | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file);
  const maxWidth = mode === "archival" ? EVIDENCE_ARCHIVE_MAX_EDGE : EVIDENCE_MAX_WIDTH;
  const maxHeight = mode === "archival" ? EVIDENCE_ARCHIVE_MAX_EDGE : EVIDENCE_MAX_HEIGHT;
  const sized = scaleSize(bitmap.width, bitmap.height, maxWidth, maxHeight);
  let quality = mode === "archival" ? EVIDENCE_ARCHIVE_QUALITY : EVIDENCE_FULL_QUALITY;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    blob = await canvasToJpeg(bitmap, sized.width, sized.height, quality);
    if (!blob) break;
    if (blob.size <= EVIDENCE_PHOTO_STORE_MAX_BYTES || quality <= 0.62) break;
    quality = Math.max(0.62, quality - 0.06);
  }
  bitmap.close();
  if (!blob) return null;
  const encoded = new Uint8Array(await blob.arrayBuffer());
  const withExif = copyJpegMetadata(sourceBytes, encoded);
  return new File([withExif], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });
}

export async function prepareEvidenceWithCodec(
  file: File,
  mode: EvidenceEncodeMode = "full",
): Promise<PreparedEvidence> {
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const exif = extractEvidenceMetadata(sourceBytes, file.type || "image/jpeg");
  if (isPdf(file)) {
    if (file.size > EVIDENCE_PHOTO_STORE_MAX_BYTES) {
      throw new Error("Payment receipts must stay under the evidence size limit.");
    }
    return {
      file,
      bytes: sourceBytes,
      exif,
      quality: "full",
      encoded: false,
    };
  }
  if (!evidenceNeedsEncode(file, exif, mode)) {
    return {
      file,
      bytes: sourceBytes,
      exif,
      width: exif.width,
      height: exif.height,
      quality: "full",
      encoded: false,
    };
  }
  const encodedFile = await encodeWithSystemCodec(file, sourceBytes, mode);
  if (!encodedFile) {
    throw new Error("This photo is larger than 4K 10-bit and could not be compressed on this device.");
  }
  const bytes = new Uint8Array(await encodedFile.arrayBuffer());
  const nextExif = {
    ...exif,
    ...extractEvidenceMetadata(bytes, "image/jpeg"),
    make: exif.make,
    model: exif.model,
    software: exif.software,
    dateTime: exif.dateTime,
    dateTimeOriginal: exif.dateTimeOriginal,
    gpsLatitude: exif.gpsLatitude,
    gpsLongitude: exif.gpsLongitude,
    iso: exif.iso,
    exposureTime: exif.exposureTime,
    fNumber: exif.fNumber,
    focalLength: exif.focalLength,
  };
  return {
    file: encodedFile,
    bytes,
    exif: nextExif,
    width: nextExif.width,
    height: nextExif.height,
    quality: mode,
    encoded: true,
  };
}
