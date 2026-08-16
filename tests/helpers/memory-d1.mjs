import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Minimal D1-compatible wrapper over Node's built-in SQLite for Worker tests.
 * Implements prepare/bind/all/raw/run/first/batch/exec used by Drizzle's D1 driver.
 */
export function createMemoryD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");

  function wrapStatement(sqlText) {
    let bound = [];
    const api = {
      bind(...values) {
        bound = values.map((value) => (value === undefined ? null : value));
        return api;
      },
      async all() {
        const results = db.prepare(sqlText).all(...bound);
        return {
          success: true,
          meta: {
            changes: 0,
            duration: 0,
            last_row_id: 0,
            rows_read: results.length,
            rows_written: 0,
            size_after: 0,
            changed_db: false,
          },
          results,
        };
      },
      async first(columnName) {
        const row = db.prepare(sqlText).get(...bound) ?? null;
        if (!row) return null;
        if (columnName) return row[columnName] ?? null;
        return row;
      },
      async run() {
        const info = db.prepare(sqlText).run(...bound);
        return {
          success: true,
          meta: {
            changes: info.changes,
            duration: 0,
            last_row_id: Number(info.lastInsertRowid),
            rows_read: 0,
            rows_written: info.changes,
            size_after: 0,
            changed_db: info.changes > 0,
          },
          results: [],
        };
      },
      async raw() {
        const statement = db.prepare(sqlText);
        statement.setReturnArrays(true);
        return statement.all(...bound);
      },
    };
    return api;
  }

  return {
    prepare(sqlText) {
      return wrapStatement(sqlText);
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) {
        try {
          results.push(await statement.all());
        } catch {
          results.push(await statement.run());
        }
      }
      return results;
    },
    async exec(query) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },
    /** @internal test assertions only — not part of the D1 surface */
    __sqlite: db,
  };
}

export function applyMarketplaceMigrations(d1) {
  const files = [
    "drizzle/0000_ambitious_blockbuster.sql",
    "drizzle/0001_rapid_leper_queen.sql",
    "drizzle/0002_married_wolverine.sql",
    "drizzle/0003_ambitious_hawkeye.sql",
    "drizzle/0004_chat_sale_credit.sql",
    "drizzle/0005_sale_status.sql",
    "drizzle/0006_paypal_sale_price.sql",
    "drizzle/0007_sale_evidence.sql",
    "drizzle/0008_shipping_evidence.sql",
  ];
  for (const relativePath of files) {
    const sql = readFileSync(join(repoRoot, relativePath), "utf8");
    for (const part of sql.split(/-->\s*statement-breakpoint\s*/g)) {
      const statement = part.trim();
      if (statement) d1.__sqlite.exec(statement);
    }
  }
}
