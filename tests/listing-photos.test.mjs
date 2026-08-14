import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LISTING_PHOTO_LIMIT,
  appendPhotoFiles,
  manifestsFromPhotoDrafts,
  movePhotoDraft,
  photoDraftsFromExisting,
  photoDraftsFromManifest,
  removePhotoDraft,
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
  assert.match(marketplace, /Move photo left/);
  assert.match(marketplace, /Move photo right/);
  assert.match(marketplace, /Remove photo/);
  assert.match(marketplace, /Add photos/);
  assert.match(marketplace, /manifestsFromPhotoDrafts/);
});
