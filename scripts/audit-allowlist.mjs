/**
 * Enforce that `npm audit --omit=dev` findings exactly match the reviewed allowlist.
 * Fail closed on missing npm, non-audit exits, invalid/truncated JSON, or network errors.
 * Compare exact advisory id, package, severity, and affected range from
 * docs/dependency-advisories.md — package names alone are insufficient.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const advisoryPath = join(root, "docs/dependency-advisories.md");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseAllowlist(markdown) {
  const entries = [];
  const rowRe =
    /^\|\s*`([^`]+)`\s*\|\s*(critical|high|moderate|low)\s*\|\s*(GHSA-[a-z0-9-]+)\s*\|\s*`([^`]+)`\s*\|/gim;
  let match;
  while ((match = rowRe.exec(markdown)) !== null) {
    entries.push({
      package: match[1],
      severity: match[2].toLowerCase(),
      advisory: match[3].toUpperCase(),
      range: match[4],
    });
  }
  if (!entries.length) {
    fail(
      `No exact allowlist rows found in ${advisoryPath} (need | \\\`pkg\\\` | severity | GHSA-… | \\\`range\\\` |)`,
    );
  }
  return entries;
}

function advisoryKey(entry) {
  return [
    entry.package,
    entry.severity,
    entry.advisory,
    entry.range,
  ].join("\u0000");
}

function extractGhsa(urlOrId) {
  if (!urlOrId) return null;
  const m = String(urlOrId).toUpperCase().match(/GHSA-[A-Z0-9-]+/);
  return m ? m[0] : null;
}

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

if (result.error) {
  fail(`FAIL npm audit process error: ${result.error.message}`);
}
if (result.status === null) {
  fail("FAIL npm audit produced no exit status (killed/signal)");
}
// npm audit: 0 = clean, 1 = vulnerabilities reported; anything else is tooling/network failure.
if (result.status !== 0 && result.status !== 1) {
  fail(
    `FAIL npm audit non-audit exit ${result.status}: ${(result.stderr || "").slice(0, 500)}`,
  );
}

const stdout = result.stdout ?? "";
if (!stdout.trim()) {
  fail("FAIL npm audit returned empty stdout (network or registry failure)");
}
if (!stdout.trimEnd().endsWith("}")) {
  fail("FAIL npm audit JSON appears truncated");
}

let report;
try {
  report = JSON.parse(stdout);
} catch (error) {
  fail(`FAIL invalid npm audit JSON: ${error instanceof Error ? error.message : error}`);
}

if (!report || typeof report !== "object" || Array.isArray(report)) {
  fail("FAIL npm audit JSON root must be an object");
}
if (report.error) {
  fail(
    `FAIL npm audit reported error: ${report.error?.summary || JSON.stringify(report.error)}`,
  );
}

const vulns = report.vulnerabilities;
if (vulns == null || typeof vulns !== "object") {
  fail("FAIL npm audit JSON missing vulnerabilities object");
}

const observed = [];
for (const [name, meta] of Object.entries(vulns)) {
  if (!meta || (meta.severity !== "high" && meta.severity !== "critical")) {
    continue;
  }
  const via = Array.isArray(meta.via) ? meta.via : [];
  let sawAdvisory = false;
  for (const item of via) {
    if (!item || typeof item !== "object") continue;
    const advisory = extractGhsa(item.url) || extractGhsa(item.id);
    if (!advisory) continue;
    const severity = String(item.severity || meta.severity).toLowerCase();
    if (severity !== "high" && severity !== "critical") continue;
    sawAdvisory = true;
    observed.push({
      package: name,
      severity,
      advisory,
      range: String(item.range || meta.range || ""),
    });
  }
  if (!sawAdvisory) {
    fail(
      `FAIL high/critical package ${name} has no advisory identifiers to bind against allowlist`,
    );
  }
}

if (observed.length === 0) {
  console.log("PASS production audit is clean");
  process.exit(0);
}

let advisoryMarkdown;
try {
  advisoryMarkdown = readFileSync(advisoryPath, "utf8");
} catch {
  fail(`Missing reviewed advisory file: ${advisoryPath}`);
}

const allowlist = parseAllowlist(advisoryMarkdown);
const allowKeys = new Set(allowlist.map(advisoryKey));
const observedKeys = new Set(observed.map(advisoryKey));

const unexpected = observed.filter((o) => !allowKeys.has(advisoryKey(o)));
const missing = allowlist.filter((a) => !observedKeys.has(advisoryKey(a)));

if (unexpected.length || missing.length) {
  console.error("FAIL audit allowlist mismatch (advisory-exact)");
  for (const u of unexpected) {
    console.error(
      `  unexpected: ${u.package} ${u.severity} ${u.advisory} range=${u.range}`,
    );
  }
  for (const m of missing) {
    console.error(
      `  missing from audit: ${m.package} ${m.severity} ${m.advisory} range=${m.range}`,
    );
  }
  process.exit(1);
}

console.log(
  `PASS production audit matches reviewed advisory-exact allowlist (${observed.length} findings)`,
);
process.exit(0);
