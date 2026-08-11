import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScript(relativePath) {
  const fileUrl = new URL(relativePath, import.meta.url);
  const source = await readFile(fileUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: fileUrl.pathname,
  });
  const encoded = Buffer.from(outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("admin allowlist uses exact, case-insensitive email matches", async () => {
  const { isAdminEmail } = await importTypeScript("../lib/admin-policy.ts");

  assert.equal(
    isAdminEmail(" Owner@Example.com ", "staff@example.com, owner@example.COM "),
    true,
  );
  assert.equal(
    isAdminEmail("owner@example.com.attacker.test", "owner@example.com"),
    false,
  );
  assert.equal(isAdminEmail("", ""), false);
});

test("return destinations stay on-site and avoid auth loops", async () => {
  const { sanitizeReturnTo } = await importTypeScript("../lib/auth-return-to.ts");

  assert.equal(sanitizeReturnTo("/?compose=1"), "/?compose=1");
  assert.equal(sanitizeReturnTo("https://attacker.test/"), "/account");
  assert.equal(sanitizeReturnTo("//attacker.test/"), "/account");
  assert.equal(sanitizeReturnTo("/\\attacker.test/"), "/account");
  assert.equal(sanitizeReturnTo("/api/auth/sign-in"), "/account");
  assert.equal(sanitizeReturnTo("/login?returnTo=/login"), "/account");
});
