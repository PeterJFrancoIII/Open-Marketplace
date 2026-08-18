import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readRepo(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("governance documents rank crowdsourced surface reports as foundational", async () => {
  const governance = await readRepo("../GOVERNANCE.md");
  const master = await readRepo("../Master_Descriptor.md");
  const policy = await readRepo("../POLICY.md");
  const agents = await readRepo("../AGENTS.md");

  for (const text of [governance, master, policy, agents]) {
    assert.match(text, /Bug/i);
    assert.match(text, /Feature Request|feature/i);
    assert.match(text, /community/i);
    assert.match(
      text,
      /Cybersecurity|security-control|access-control|access control/i,
    );
    assert.match(text, /administrator/i);
  }

  assert.match(governance, /foundational|community builds the product/i);
  assert.match(governance, /daily/i);
  assert.match(master, /crowdsourced_surface_feedback/);
  assert.match(master, /security_controls_never_community_owned/);
  assert.match(policy, /community_reports/);
  assert.match(agents, /Filter those requests out of the community queue/);
});
