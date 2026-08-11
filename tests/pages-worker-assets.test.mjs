import assert from "node:assert/strict";
import test from "node:test";

import { createPagesHandler } from "../scripts/pages-worker-entry.mjs";

test("serves a Cloudflare Pages static asset before the app handler", async () => {
  let appCalls = 0;
  let assetCalls = 0;

  const handler = createPagesHandler({
    async fetch() {
      appCalls += 1;
      return new Response("Not Found", { status: 404 });
    },
  });

  const response = await handler.fetch(
    new Request("https://marketplace.test/assets/app.css"),
    {
      ASSETS: {
        async fetch() {
          assetCalls += 1;
          return new Response(".app { display: grid; }", {
            status: 200,
            headers: { "content-type": "text/css" },
          });
        },
      },
    },
    {},
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/css");
  assert.equal(assetCalls, 1);
  assert.equal(appCalls, 0);
});

test("falls through to the app when Pages has no matching asset", async () => {
  let appCalls = 0;

  const handler = createPagesHandler({
    async fetch() {
      appCalls += 1;
      return new Response("<main>Marketplace</main>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    },
  });

  const response = await handler.fetch(
    new Request("https://marketplace.test/"),
    {
      ASSETS: {
        async fetch() {
          return new Response("Not Found", { status: 404 });
        },
      },
    },
    {},
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/html");
  assert.equal(await response.text(), "<main>Marketplace</main>");
  assert.equal(appCalls, 1);
});
