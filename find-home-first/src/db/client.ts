/**
 * Database client — server-only.
 *
 * - Never imported by browser/client code.
 * - Never connects at module import time.
 * - Never logs connection strings.
 * - Returns null when DATABASE_URL is absent so pages can fall back gracefully.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

/**
 * Lazily initialises the Drizzle client.
 * Returns null (not throw) when DATABASE_URL is absent.
 */
export function getDb(): DrizzleDb | null {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }

  try {
    const client = postgres(url, {
      max: 5,
      idle_timeout: 30,
      // Never surface the connection string through error messages.
      connect_timeout: 15,
    });
    _db = drizzle(client, { schema });
    return _db;
  } catch {
    // One concise warning — no credentials.
    console.warn("[find-home-first] Database client init failed. Falling back to demo data.");
    return null;
  }
}
