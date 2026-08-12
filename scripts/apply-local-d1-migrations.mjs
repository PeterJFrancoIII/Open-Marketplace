import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const d1ObjectDir = join(
  repoRoot,
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);
const migrationFiles = [
  "drizzle/0000_ambitious_blockbuster.sql",
  "drizzle/0001_rapid_leper_queen.sql",
  "drizzle/0002_married_wolverine.sql",
];

function findLocalD1Files() {
  try {
    return readdirSync(d1ObjectDir)
      .filter(
        (name) =>
          name.endsWith(".sqlite") &&
          name !== "metadata.sqlite" &&
          !name.includes("-"),
      )
      .map((name) => join(d1ObjectDir, name));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
}

const databasePaths = findLocalD1Files();
if (databasePaths.length === 0) {
  console.error(
    "No local D1 database found. Start `npm run dev` once so Miniflare can create `.wrangler/state`, then rerun this script.",
  );
  process.exit(1);
}

for (const databasePath of databasePaths) {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON;");
  const alreadyApplied = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'auth_users' LIMIT 1",
    )
    .get();
  if (alreadyApplied) {
    db.close();
    console.log(`Local D1 schema already present in ${databasePath}`);
    continue;
  }
  for (const relativePath of migrationFiles) {
    const sql = readFileSync(join(repoRoot, relativePath), "utf8");
    for (const part of sql.split(/-->\s*statement-breakpoint\s*/g)) {
      const statement = part.trim();
      if (!statement) continue;
      db.exec(statement);
    }
  }
  db.close();
  console.log(`Applied local D1 migrations to ${databasePath}`);
}
