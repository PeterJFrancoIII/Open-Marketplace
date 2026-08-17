import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LISTING_INSPECT_ZOOM_MAX,
  LISTING_INSPECT_ZOOM_MIN,
  LISTING_PHOTO_LIMIT,
  appendPhotoFiles,
  applyInspectPan,
  clampInspectZoom,
  clampPhotoIndex,
  collectLoadedPhotoUrls,
  collectPhotoUrlsInOrder,
  listingPhotoCount,
  inspectTransform,
  manifestsFromPhotoDrafts,
  movePhotoDraft,
  photoDragIndex,
  photoDraftsFromExisting,
  photoDraftsFromManifest,
  previewUrlsFromPhotoDrafts,
  removePhotoDraft,
  resetInspectView,
  stepInspectZoom,
  stepPhotoIndex,
} from "../lib/listing-photos.ts";

const lamp = {
  hash: "sha256:lamp",
  name: "lamp.jpg",
  size: 1200,
  type: "image/jpeg",
};
const chair = {
  hash: "sha256:chair",
  name: "chair.jpg",
  size: 800,
  type: "image/jpeg",
};

test("existing listing photos stay visible and can be removed or reordered", async () => {
  const placeholders = photoDraftsFromManifest([lamp, chair]);
  assert.equal(placeholders.length, 2);
  assert.equal(placeholders[0].name, "lamp.jpg");
  assert.equal(placeholders[0].previewUrl, null);

  const hydrated = await photoDraftsFromExisting([lamp, chair], async (hash) =>
    hash === lamp.hash ? "blob:lamp" : null,
  );
  assert.equal(hydrated[0].previewUrl, "blob:lamp");
  assert.equal(hydrated[1].previewUrl, null);
  assert.equal(hydrated[1].name, "chair.jpg");

  const reordered = movePhotoDraft(hydrated, 0, 1);
  assert.equal(reordered[0].name, "chair.jpg");
  assert.equal(reordered[1].name, "lamp.jpg");
  assert.deepEqual(movePhotoDraft(hydrated, 0, 0), hydrated);
  assert.equal(photoDragIndex("1", 3), 1);
  assert.equal(photoDragIndex("9", 2), null);
  assert.equal(photoDragIndex("abc", 2), null);

  const removed = removePhotoDraft(reordered, 0);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].name, "lamp.jpg");

  const manifests = await manifestsFromPhotoDrafts(removed, async () => {
    throw new Error("existing photos should not be re-stored");
  });
  assert.deepEqual(manifests, [lamp]);
});

test("new photos append up to six and keep existing ones", async () => {
  const current = photoDraftsFromManifest([lamp]);
  const files = [
    { name: "new-a.jpg", size: 10, lastModified: 1 },
    { name: "new-b.jpg", size: 11, lastModified: 2 },
  ];
  const next = appendPhotoFiles(current, files, (file) => `blob:${file.name}`);
  assert.equal(next.length, 3);
  assert.equal(next[0].manifest?.hash, lamp.hash);
  assert.equal(next[1].name, "new-a.jpg");
  assert.equal(next[2].previewUrl, "blob:new-b.jpg");

  const almostFull = photoDraftsFromManifest(
    Array.from({ length: LISTING_PHOTO_LIMIT - 1 }, (_, index) => ({
      ...lamp,
      hash: `sha256:${index}`,
      name: `photo-${index}.jpg`,
    })),
  );
  const capped = appendPhotoFiles(
    almostFull,
    files,
    (file) => `blob:${file.name}`,
  );
  assert.equal(capped.length, LISTING_PHOTO_LIMIT);
  assert.equal(capped.at(-1)?.name, "new-a.jpg");
});

test("compose UI lets owners add, remove, and reorder assigned photos", async () => {
  const marketplace = await readFile(
    new URL("../app/marketplace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(marketplace, /photoDraftsFromExisting/);
  assert.match(marketplace, /pinListingMediaToHost/);
  assert.match(marketplace, /listingPhotoLoader/);
  assert.match(marketplace, /Move photo left/);
  assert.match(marketplace, /Move photo right/);
  assert.match(marketplace, /handlePhotoDrop/);
  assert.match(marketplace, /Drag photos to change the display order/);
  assert.match(marketplace, /Listings page/);
  assert.match(marketplace, /Remove photo/);
  assert.match(marketplace, /Add photos/);
  assert.match(marketplace, /manifestsFromPhotoDrafts/);
  assert.match(marketplace, /collectPhotoUrlsInOrder/);
  assert.match(marketplace, /Show photo/);
  assert.match(marketplace, /Previous photo/);
  assert.match(marketplace, /Next photo/);
  assert.match(marketplace, /Inspect listing photo/);
  assert.match(marketplace, /Zoom in/);
  assert.match(marketplace, /Zoom out/);
  assert.match(marketplace, /Reset zoom/);
  assert.doesNotMatch(marketplace, /Social trust profile/);
  assert.doesNotMatch(marketplace, /social-editor/);
});

test("listing viewer wraps photo indexes and clamps inspect zoom/pan", async () => {
  assert.equal(clampPhotoIndex(0, 0), 0);
  assert.equal(clampPhotoIndex(4, 3), 2);
  assert.equal(clampPhotoIndex(-1, 3), 0);
  assert.equal(stepPhotoIndex(0, 3, 1), 1);
  assert.equal(stepPhotoIndex(2, 3, 1), 0);
  assert.equal(stepPhotoIndex(0, 3, -1), 2);
  assert.equal(stepPhotoIndex(1, 0, 1), 0);

  assert.equal(clampInspectZoom(Number.NaN), LISTING_INSPECT_ZOOM_MIN);
  assert.equal(stepInspectZoom(1, 1), 1.5);
  assert.equal(stepInspectZoom(LISTING_INSPECT_ZOOM_MAX, 1), LISTING_INSPECT_ZOOM_MAX);
  assert.equal(stepInspectZoom(1, -1), LISTING_INSPECT_ZOOM_MIN);

  const reset = resetInspectView();
  assert.deepEqual(reset, { zoom: 1, pan: { x: 0, y: 0 } });
  assert.deepEqual(applyInspectPan({ x: 8, y: 4 }, 2, -1, 1), { x: 0, y: 0 });
  assert.deepEqual(applyInspectPan({ x: 8, y: 4 }, 2, -1, 2), { x: 10, y: 3 });
  assert.equal(inspectTransform(2, { x: 10, y: -4 }), "translate(10px, -4px) scale(2)");
  assert.equal(inspectTransform(1, { x: 10, y: -4 }), "translate(0px, 0px) scale(1)");

  const ordered = await collectPhotoUrlsInOrder(
    ["sha256:lamp", "", "sha256:missing", "sha256:chair"],
    async (hash) => (hash === "sha256:missing" ? null : `blob:${hash}`),
  );
  assert.deepEqual(ordered, ["blob:sha256:lamp", "", "", "blob:sha256:chair"]);
  const urls = await collectLoadedPhotoUrls(
    ["sha256:lamp", "", "sha256:missing", "sha256:chair"],
    async (hash) => (hash === "sha256:missing" ? null : `blob:${hash}`),
  );
  assert.deepEqual(urls, ["blob:sha256:lamp", "blob:sha256:chair"]);
  assert.equal(listingPhotoCount(3), 3);
  assert.equal(listingPhotoCount(0), 0);
  assert.deepEqual(
    previewUrlsFromPhotoDrafts([
      { key: "a", previewUrl: "blob:a", name: "a.jpg", manifest: lamp, file: null, revokeOnRemove: false },
      { key: "b", previewUrl: null, name: "b.jpg", manifest: chair, file: null, revokeOnRemove: false },
    ]),
    ["blob:a"],
  );
});
