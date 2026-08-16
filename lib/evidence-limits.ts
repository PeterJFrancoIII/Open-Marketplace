export const EVIDENCE_MAX_WIDTH = 3840;
export const EVIDENCE_MAX_HEIGHT = 2160;
export const EVIDENCE_MAX_BIT_DEPTH = 8;
export const EVIDENCE_PHOTOS_PER_KIND = 3;
export const EVIDENCE_ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
export const EVIDENCE_ARCHIVE_MAX_EDGE = 1600;
export const EVIDENCE_FULL_QUALITY = 0.92;
export const EVIDENCE_ARCHIVE_QUALITY = 0.58;
export const EVIDENCE_PHOTO_STORE_MAX_BYTES = 1_200_000;
export const EVIDENCE_PHOTO_MAX_BYTES = EVIDENCE_PHOTO_STORE_MAX_BYTES;

export function evidenceArchiveDue(
  completedAt: string | null | undefined,
  now = Date.now(),
) {
  if (!completedAt) return false;
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(completed)) return false;
  return now - completed >= EVIDENCE_ARCHIVE_AFTER_MS;
}

export function laterTimestamp(left?: string | null, right?: string | null) {
  if (!left) return right ?? null;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}
