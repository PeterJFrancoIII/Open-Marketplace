import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertBlobMatchesHash,
  mediaNodeObjectPath,
  parseMediaNodeOrigin,
  toSha256Hash,
} from "../lib/media-node.ts";

test("media node origins stay https or local http and never carry secrets", () => {
  assert.equal(
    parseMediaNodeOrigin("https://photos.example.com/"),
    "https://photos.example.com",
  );
  assert.equal(parseMediaNodeOrigin("http://localhost:8788"), "http://localhost:8788");
  assert.equal(parseMediaNodeOrigin("http://diskstation.local:8788"), "http://diskstation.local:8788");
  assert.equal(parseMediaNodeOrigin("http://192.168.1.20:8788"), null);
  assert.equal(parseMediaNodeOrigin("https://user:token@photos.example.com"), null);
  assert.equal(parseMediaNodeOrigin("javascript:alert(1)"), null);
  assert.equal(parseMediaNodeOrigin("https://photos.example.com/extra"), null);
});

test("content-addressed paths and hash checks reject spoofed bytes", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const hash = await toSha256Hash(bytes.buffer);
  assert.match(hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(mediaNodeObjectPath(hash), `/media/sha256/${hash.slice(7)}`);
  assert.equal(mediaNodeObjectPath("not-a-hash"), null);

  const matching = new Blob([bytes]);
  await assertBlobMatchesHash(hash, matching);
  await assert.rejects(
    () => assertBlobMatchesHash(hash, new Blob([new Uint8Array([9, 9, 9])])),
    /do not match/,
  );
});

test("account settings and compose keep photos off the public registry", async () => {
  const settings = await readFile(
    new URL("../app/account/account-settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(settings, /First database host/);
  assert.match(settings, /writeMediaNodeConfig/);
  assert.match(settings, /probeMediaNode/);
  assert.doesNotMatch(settings, /filled from Facebook/);

  const store = await readFile(new URL("../lib/media-store.ts", import.meta.url), "utf8");
  assert.match(store, /publishMediaToNode/);
  assert.match(store, /fetchMediaFromOrigins/);
  assert.doesNotMatch(store, /\/api\/listings/);

  const listings = await readFile(
    new URL("../app/api/listings/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(listings, /image bytes|arrayBuffer|multipart/);
});
