import { EVIDENCE_PHOTO_MAX_BYTES } from "./sale-evidence";

export type EvidencePhotoDraft = {
  hash: string;
  name: string;
  size: number;
  type: string;
  hosts?: string[];
  dataUrl: string;
};

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}

export async function prepareEvidenceFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= EVIDENCE_PHOTO_MAX_BYTES) {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.72),
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
