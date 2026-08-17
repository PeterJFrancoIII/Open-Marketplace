import type { MediaManifest } from "./types";

export const LISTING_PHOTO_LIMIT = 6;

export type PhotoDraft = {
  key: string;
  previewUrl: string | null;
  name: string;
  manifest: MediaManifest | null;
  file: File | null;
  revokeOnRemove: boolean;
};

export function photoDraftsFromManifest(manifests: MediaManifest[]): PhotoDraft[] {
  return manifests.slice(0, LISTING_PHOTO_LIMIT).map((manifest, index) => ({
    key: manifest.hash || `existing-${index}`,
    previewUrl: null,
    name: manifest.name,
    manifest,
    file: null,
    revokeOnRemove: false,
  }));
}

export async function photoDraftsFromExisting(
  manifests: MediaManifest[],
  loadUrl: (hash: string) => Promise<string | null>,
): Promise<PhotoDraft[]> {
  const drafts: PhotoDraft[] = [];
  for (const [index, manifest] of manifests.slice(0, LISTING_PHOTO_LIMIT).entries()) {
    const previewUrl = await loadUrl(manifest.hash).catch(() => null);
    drafts.push({
      key: manifest.hash || `existing-${index}`,
      previewUrl,
      name: manifest.name,
      manifest,
      file: null,
      revokeOnRemove: Boolean(previewUrl),
    });
  }
  return drafts;
}

export function appendPhotoFiles(
  current: PhotoDraft[],
  files: File[],
  createPreviewUrl: (file: File) => string,
): PhotoDraft[] {
  const room = Math.max(0, LISTING_PHOTO_LIMIT - current.length);
  const added = files.slice(0, room).map((file, index) => ({
    key: `new-${file.name}-${file.size}-${file.lastModified}-${index}`,
    previewUrl: createPreviewUrl(file),
    name: file.name,
    manifest: null,
    file,
    revokeOnRemove: true,
  }));
  return [...current, ...added];
}

export function removePhotoDraft(current: PhotoDraft[], index: number): PhotoDraft[] {
  return current.filter((_, itemIndex) => itemIndex !== index);
}

export const PHOTO_DRAG_TYPE = "application/x-open-marketplace-photo-index";

export function photoDragIndex(data: string | null | undefined, length: number): number | null {
  if (data == null || data === "") return null;
  const index = Number.parseInt(data, 10);
  if (!Number.isInteger(index) || index < 0 || index >= length) return null;
  return index;
}

export function movePhotoDraft(
  current: PhotoDraft[],
  from: number,
  to: number,
): PhotoDraft[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= current.length ||
    to >= current.length
  ) {
    return current;
  }
  const next = [...current];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function revokePhotoDraft(draft: PhotoDraft) {
  if (draft.revokeOnRemove && draft.previewUrl) {
    URL.revokeObjectURL(draft.previewUrl);
  }
}

export const LISTING_INSPECT_ZOOM_MIN = 1;
export const LISTING_INSPECT_ZOOM_MAX = 4;
export const LISTING_INSPECT_ZOOM_STEP = 0.5;

export type InspectPan = { x: number; y: number };

export function clampPhotoIndex(index: number, length: number): number {
  if (!Number.isInteger(length) || length <= 0) return 0;
  if (!Number.isInteger(index)) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

export function stepPhotoIndex(index: number, length: number, delta: number): number {
  if (!Number.isInteger(length) || length <= 0) return 0;
  if (!Number.isInteger(delta)) return clampPhotoIndex(index, length);
  const current = clampPhotoIndex(index, length);
  return ((current + delta) % length + length) % length;
}

export function clampInspectZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return LISTING_INSPECT_ZOOM_MIN;
  return Math.min(LISTING_INSPECT_ZOOM_MAX, Math.max(LISTING_INSPECT_ZOOM_MIN, zoom));
}

export function stepInspectZoom(zoom: number, direction: 1 | -1): number {
  return clampInspectZoom(zoom + direction * LISTING_INSPECT_ZOOM_STEP);
}

export function resetInspectView(): { zoom: number; pan: InspectPan } {
  return { zoom: LISTING_INSPECT_ZOOM_MIN, pan: { x: 0, y: 0 } };
}

export function applyInspectPan(
  pan: InspectPan,
  dx: number,
  dy: number,
  zoom: number,
): InspectPan {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return pan;
  if (clampInspectZoom(zoom) <= LISTING_INSPECT_ZOOM_MIN) return { x: 0, y: 0 };
  return { x: pan.x + dx, y: pan.y + dy };
}

export function inspectTransform(zoom: number, pan: InspectPan): string {
  const safeZoom = clampInspectZoom(zoom);
  const safePan = safeZoom <= LISTING_INSPECT_ZOOM_MIN ? { x: 0, y: 0 } : pan;
  return `translate(${safePan.x}px, ${safePan.y}px) scale(${safeZoom})`;
}

export async function collectLoadedPhotoUrls(
  hashes: string[],
  loadUrl: (hash: string) => Promise<string | null>,
): Promise<string[]> {
  return (await collectPhotoUrlsInOrder(hashes, loadUrl)).filter(Boolean);
}

export async function collectPhotoUrlsInOrder(
  hashes: string[],
  loadUrl: (hash: string) => Promise<string | null>,
): Promise<string[]> {
  const urls: string[] = [];
  for (const hash of hashes) {
    if (!hash) {
      urls.push("");
      continue;
    }
    const url = await loadUrl(hash).catch(() => null);
    urls.push(url ?? "");
  }
  return urls;
}

export function listingPhotoCount(manifestLength: number): number {
  return Number.isInteger(manifestLength) && manifestLength > 0 ? manifestLength : 0;
}

export function previewUrlsFromPhotoDrafts(drafts: PhotoDraft[]): string[] {
  return drafts
    .map((draft) => draft.previewUrl)
    .filter((url): url is string => Boolean(url));
}

export async function manifestsFromPhotoDrafts(
  drafts: PhotoDraft[],
  storeFiles: (files: File[]) => Promise<MediaManifest[]>,
): Promise<MediaManifest[]> {
  const manifests: MediaManifest[] = [];
  for (const draft of drafts) {
    if (draft.manifest) {
      manifests.push(draft.manifest);
      continue;
    }
    if (!draft.file) continue;
    const [stored] = await storeFiles([draft.file]);
    if (stored) manifests.push(stored);
  }
  return manifests;
}
