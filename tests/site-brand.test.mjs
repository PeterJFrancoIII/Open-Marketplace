import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("public chat-link brand uses the owner logo and Open Marketplace title", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const logo = await stat(new URL("../public/open-marketplace-logo.png", import.meta.url));

  assert.ok(logo.size > 10_000);
  assert.match(layout, /default:\s*"Open Marketplace"/);
  assert.match(layout, /applicationName:\s*"Open Marketplace"/);
  assert.match(layout, /siteName:\s*"Open Marketplace"/);
  assert.match(layout, /openGraph:/);
  assert.match(layout, /twitter:/);
  assert.match(layout, /\/open-marketplace-logo\.png/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(layout, /favicon\.svg/);
});
