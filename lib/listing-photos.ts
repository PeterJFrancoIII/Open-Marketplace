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
