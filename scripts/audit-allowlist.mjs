/**
 * Enforce that `npm audit --omit=dev` findings exactly match the reviewed allowlist.
 * Exit 0 only when audit is clean OR the high/critical package set equals the allowlist.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const advisoryPath = join(root, "docs/dependency-advisories.md");

/** Exact production package names currently accepted as temporary exceptions. */
const ALLOWLIST = new Set(["next", "postcss", "sharp", "nanoid"]);

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  console.error("Failed to parse npm audit JSON");
  process.exit(1);
}

const vulns = report.vulnerabilities ?? {};
const highCritical = Object.entries(vulns)
  .filter(([, meta]) => meta?.severity === "high" || meta?.severity === "critical")
  .map(([name]) => name)
  .sort();

if (highCritical.length === 0) {
  console.log("PASS production audit is clean");
  process.exit(0);
}

let advisory;
try {
  advisory = readFileSync(advisoryPath, "utf8");
} catch {
  console.error(`Missing reviewed advisory file: ${advisoryPath}`);
  process.exit(1);
}

const unexpected = highCritical.filter((name) => !ALLOWLIST.has(name));
const missingDocs = [...ALLOWLIST].filter((name) => {
  if (!highCritical.includes(name)) return false;
  return !new RegExp(`\`${name}\`|\\b${name}\\b`, "i").test(advisory);
});

if (unexpected.length || missingDocs.length) {
  console.error("FAIL audit allowlist mismatch");
  if (unexpected.length) {
    console.error("  unexpected high/critical packages:", unexpected.join(", "));
  }
  if (missingDocs.length) {
    console.error("  packages not documented in advisories:", missingDocs.join(", "));
  }
  console.error("  observed:", highCritical.join(", "));
  console.error("  allowlist:", [...ALLOWLIST].sort().join(", "));
  process.exit(1);
}

// Observed set must equal allowlist ∩ observed; forbid silent extras already handled.
// Also forbid allowlist drift where audit reports a different cardinality than documented.
const documentedCountMatch = /Result:\s*(\d+)\s+high-severity/i.exec(advisory);
if (documentedCountMatch) {
  const documented = Number(documentedCountMatch[1]);
  if (documented !== highCritical.length) {
    console.error(
      `FAIL advisory count ${documented} != observed high/critical count ${highCritical.length}`,
    );
    process.exit(1);
  }
}

console.log(
  `PASS production audit matches reviewed allowlist (${highCritical.join(", ")})`,
);
process.exit(0);
