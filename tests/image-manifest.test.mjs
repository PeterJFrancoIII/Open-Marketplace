import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  attachMediaHosts,
  publicMediaOriginsFromManifests,
  sanitizeImageManifest,
  sanitizeMediaHosts,
} from "../lib/image-manifest.ts";

test("listing photo hosts stay public https origins and never carry secrets", () => {
  assert.deepEqual(
    sanitizeMediaHosts([
      "https://open-marketplace-first-public-database-host.example/",
      "http://192.168.1.20:8788",
      "https://user:token@photos.example.com",
      "javascript:alert(1)",
    ]),
    ["https://open-marketplace-first-public-database-host.example"],
  );

  const manifests = sanitizeImageManifest([
    {
      hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      name: "lamp.jpg",
      size: 12,
      type: "image/jpeg",
      hosts: ["https://host.example", "http://192.168.1.8"],
      accessToken: "nope",
    },
    { hash: "not-a-hash", name: "bad.jpg" },
  ]);
  assert.equal(manifests.length, 1);
  assert.deepEqual(manifests[0].hosts, ["https://host.example"]);
  assert.equal(
    attachMediaHosts(manifests[0], ["https://host.example/", "https://peer.example"]).hosts?.length,
    2,
  );
  assert.deepEqual(publicMediaOriginsFromManifests(manifests), ["https://host.example"]);
});

test("listing writes keep host hints and strip photo bytes", async () => {
  const listings = await readFile(
    new URL("../app/api/listings/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(listings, /sanitizeImageManifest/);
  assert.doesNotMatch(listings, /image bytes|arrayBuffer|multipart/);

  const store = await readFile(new URL("../lib/media-store.ts", import.meta.url), "utf8");
  assert.match(store, /pinListingMediaToHost/);
  assert.match(store, /fetchMediaFromOrigins/);
  assert.doesNotMatch(store, /\/api\/listings/);
});
