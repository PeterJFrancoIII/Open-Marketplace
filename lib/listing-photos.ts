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

export type InspectView = { zoom: number; pan: InspectPan };

export type InspectWheelInput = {
  deltaX: number;
  deltaY: number;
  deltaMode?: number;
  pinch: boolean;
  originX?: number;
  originY?: number;
};

const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 600;
const PINCH_WHEEL_GAIN = 0.01;

function finitePan(pan: InspectPan): InspectPan {
  return {
    x: Number.isFinite(pan.x) ? pan.x : 0,
    y: Number.isFinite(pan.y) ? pan.y : 0,
  };
}

export function applyInspectPan(
  pan: InspectPan,
  dx: number,
  dy: number,
  zoom = LISTING_INSPECT_ZOOM_MIN,
): InspectPan {
  void zoom;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return finitePan(pan);
  const current = finitePan(pan);
  return { x: current.x + dx, y: current.y + dy };
}

export function inspectTransform(zoom: number, pan: InspectPan): string {
  const safeZoom = clampInspectZoom(zoom);
  const safePan = finitePan(pan);
  return `translate(${safePan.x}px, ${safePan.y}px) scale(${safeZoom})`;
}

export function normalizeWheelDelta(delta: number, deltaMode = 0): number {
  if (!Number.isFinite(delta)) return 0;
  if (deltaMode === 1) return delta * WHEEL_LINE_PX;
  if (deltaMode === 2) return delta * WHEEL_PAGE_PX;
  return delta;
}

export function applyInspectZoomAt(
  view: InspectView,
  nextZoom: number,
  originX = 0,
  originY = 0,
): InspectView {
  const prev = clampInspectZoom(view.zoom);
  const zoom = clampInspectZoom(nextZoom);
  const ox = Number.isFinite(originX) ? originX : 0;
  const oy = Number.isFinite(originY) ? originY : 0;
  const pan = finitePan(view.pan);
  if (zoom === prev) return { zoom, pan };
  const scale = zoom / prev;
  return {
    zoom,
    pan: {
      x: ox - (ox - pan.x) * scale,
      y: oy - (oy - pan.y) * scale,
    },
  };
}

export function applyInspectWheel(view: InspectView, input: InspectWheelInput): InspectView {
  const mode = input.deltaMode ?? 0;
  const dx = normalizeWheelDelta(input.deltaX, mode);
  const dy = normalizeWheelDelta(input.deltaY, mode);
  if (input.pinch) {
    const factor = Math.exp(-dy * PINCH_WHEEL_GAIN);
    if (!Number.isFinite(factor) || factor <= 0) {
      return { zoom: clampInspectZoom(view.zoom), pan: finitePan(view.pan) };
    }
    return applyInspectZoomAt(view, view.zoom * factor, input.originX ?? 0, input.originY ?? 0);
  }
  return {
    zoom: clampInspectZoom(view.zoom),
    pan: applyInspectPan(view.pan, -dx, -dy, view.zoom),
  };
}

export function applyInspectGestureScale(
  start: InspectView,
  scale: number,
  originX = 0,
  originY = 0,
): InspectView {
  if (!Number.isFinite(scale) || scale <= 0) {
    return { zoom: clampInspectZoom(start.zoom), pan: finitePan(start.pan) };
  }
  return applyInspectZoomAt(start, start.zoom * scale, originX, originY);
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
