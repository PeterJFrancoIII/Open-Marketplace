import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account settings require Connect and hide typed social fields", async () => {
  const [settings, profileSettings] = await Promise.all([
    readFile(new URL("../app/account/account-settings.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/profile-settings.ts", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /Social profiles can only be added with official Connect/);
  assert.match(settings, /Connect Facebook/);
  assert.match(settings, /Connect Instagram is not available/);
  assert.match(settings, /Connect TikTok is not available/);
  assert.doesNotMatch(settings, /Save Facebook profile/);
  assert.doesNotMatch(settings, /Connect social media/);
  assert.doesNotMatch(settings, /Account created/);
  assert.doesNotMatch(settings, /Followers/);
  assert.doesNotMatch(settings, /Public Facebook profile/);
  assert.doesNotMatch(settings, /placeholder=.*username/);
  assert.match(profileSettings, /SOCIAL_CONNECT_ONLY_ERROR/);
  assert.match(profileSettings, /Typed usernames and pasted links are not accepted/);
  assert.match(profileSettings, /metricsSource !== "oauth"/);
});
