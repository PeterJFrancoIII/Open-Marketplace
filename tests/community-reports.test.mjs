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

test("surface links stay on-site and carry the selected control", async () => {
  const {
    buildSurfaceHref,
    sanitizeSurfaceHref,
    slugSurfaceId,
  } = await importTypeScript("../lib/community-reports.ts");

  assert.equal(
    buildSurfaceHref("/", "marketplace-search"),
    "/?surface=marketplace-search#surface-marketplace-search",
  );
  assert.equal(
    buildSurfaceHref("/account/settings?tab=pay", "paypal-destination"),
    "/account/settings?tab=pay&surface=paypal-destination#surface-paypal-destination",
  );
  assert.equal(sanitizeSurfaceHref("https://attacker.test/"), null);
  assert.equal(sanitizeSurfaceHref("//attacker.test/"), null);
  assert.equal(sanitizeSurfaceHref("/\\attacker.test/"), null);
  assert.equal(sanitizeSurfaceHref("/login?surface=email"), "/login?surface=email");
  assert.equal(slugSurfaceId(["Search listings", "INPUT"]), "search-listings-input");
});

test("community reports reject invalid payloads and keep the surface href", async () => {
  const { parseCommunityReportInput } = await importTypeScript(
    "../lib/community-reports.ts",
  );

  const parsed = parseCommunityReportInput({
    kind: "bug",
    title: "Search field ignores cameras",
    details: "Typing cameras still shows furniture.",
    surfaceId: "Search listings",
    surfaceLabel: "Search listings",
    surfaceHref: "/?surface=search-listings#surface-search-listings",
    pagePath: "/",
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.kind, "bug");
    assert.equal(parsed.value.surfaceId, "search-listings");
    assert.match(parsed.value.surfaceHref, /surface=search-listings/);
  }

  assert.equal(parseCommunityReportInput({ kind: "idea" }).ok, false);
  assert.equal(
    parseCommunityReportInput({
      kind: "feature",
      title: "short",
      details: "Need this.",
      surfaceId: "list",
      surfaceHref: "https://evil.test/",
      pagePath: "/",
    }).ok,
    false,
  );
});

test("security-control requests never enter the community queue", async () => {
  const { classifyCommunityReport } = await importTypeScript(
    "../lib/community-reports.ts",
  );

  assert.equal(
    classifyCommunityReport({
      kind: "feature",
      title: "Let users change who is admin",
      details: "The community should control the admin allowlist.",
      surfaceId: "admin-overview",
      surfaceHref: "/admin?surface=admin-overview",
      pagePath: "/admin",
    }).status,
    "filtered_security",
  );
  assert.equal(
    classifyCommunityReport({
      kind: "feature",
      title: "Add a way to bypass authentication",
      details: "Skip login so posting is faster.",
      surfaceId: "log-in",
      surfaceHref: "/login?surface=log-in",
      pagePath: "/login",
    }).status,
    "filtered_security",
  );
  assert.equal(
    classifyCommunityReport({
      kind: "bug",
      title: "Please steal session cookies here",
      details: "Need a keylogger on checkout.",
      surfaceId: "list-an-item",
      surfaceHref: "/?surface=list-an-item",
      pagePath: "/",
    }).status,
    "filtered_security",
  );
  assert.equal(
    classifyCommunityReport({
      kind: "feature",
      title: "Turn off two-factor authentication",
      details: "2FA is annoying for testers.",
      surfaceId: "account-settings",
      surfaceHref: "/account/settings?surface=account-settings",
      pagePath: "/account/settings",
    }).status,
    "filtered_security",
  );
});

test("ordinary product bugs and features stay in the community queue", async () => {
  const { classifyCommunityReport, compileCommunityDigest } =
    await importTypeScript("../lib/community-reports.ts");

  const searchBug = classifyCommunityReport({
    kind: "bug",
    title: "Search field ignores cameras",
    details: "Typing cameras still shows furniture.",
    surfaceId: "search-listings",
    surfaceHref: "/?surface=search-listings",
    pagePath: "/",
  });
  assert.equal(searchBug.status, "queued");

  const loginBug = classifyCommunityReport({
    kind: "bug",
    title: "Log in button is cut off on mobile",
    details: "The label wraps under the icon on a 320px screen.",
    surfaceId: "log-in",
    surfaceHref: "/login?surface=log-in",
    pagePath: "/login",
  });
  assert.equal(loginBug.status, "queued");

  const feature = classifyCommunityReport({
    kind: "feature",
    title: "Save recent searches on the home page",
    details: "Keep the last three queries under the search field.",
    surfaceId: "search-listings",
    surfaceHref: "/?surface=search-listings",
    pagePath: "/",
  });
  assert.equal(feature.status, "queued");

  const digest = compileCommunityDigest(
    [
      {
        id: "1",
        kind: "bug",
        status: "queued",
        title: "Search field ignores cameras",
        details: "Typing cameras still shows furniture.",
        surfaceId: "search-listings",
        surfaceLabel: "Search listings",
        surfaceHref: "/?surface=search-listings",
        pagePath: "/",
        reporterUserId: null,
        createdAt: "2026-08-18T16:00:00.000Z",
      },
      {
        id: "2",
        kind: "feature",
        status: "filtered_security",
        title: "Let users change who is admin",
        details: "Community should own admin.",
        surfaceId: "admin-overview",
        surfaceLabel: "Admin overview",
        surfaceHref: "/admin?surface=admin-overview",
        pagePath: "/admin",
        reporterUserId: null,
        createdAt: "2026-08-18T16:05:00.000Z",
      },
    ],
    new Date("2026-08-18T20:00:00.000Z"),
  );
  assert.equal(digest.queuedBugCount, 1);
  assert.equal(digest.queuedFeatureCount, 0);
  assert.equal(digest.filteredSecurityCount, 1);
  assert.match(digest.markdown, /Search listings/);
  assert.doesNotMatch(digest.markdown, /Let users change who is admin/);
});
