import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type AppDb = DrizzleD1Database<typeof schema>;

async function requireD1Binding() {
  // Keep the Worker-only module behind the API call so the static marketplace
  // shell can also be imported by Node-based artifact validation.
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database.",
    );
  }
  return env.DB;
}

export async function getDb(): Promise<AppDb> {
  const binding = await requireD1Binding();
  return drizzle(binding, { schema });
}

/** Raw D1 binding for atomic multi-statement batches. */
export async function getD1() {
  return requireD1Binding();
}
