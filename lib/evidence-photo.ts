import { prepareEvidenceWithCodec, type EvidenceEncodeMode } from "./evidence-codec.ts";

export { EVIDENCE_PHOTOS_PER_KIND } from "./evidence-limits.ts";

export type EvidencePhotoDraft = {
  hash: string;
  name: string;
  size: number;
  type: string;
  hosts?: string[];
  dataUrl: string;
  exif?: Record<string, string | number | undefined> | null;
  width?: number;
  height?: number;
  quality?: "full" | "archival";
};

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareEvidenceFile(
  file: File,
  mode: EvidenceEncodeMode = "full",
): Promise<File> {
  const prepared = await prepareEvidenceWithCodec(file, mode);
  return prepared.file;
}

export async function prepareEvidenceUpload(
  file: File,
  mode: EvidenceEncodeMode = "full",
) {
  return prepareEvidenceWithCodec(file, mode);
}
