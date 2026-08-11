/**
 * migration-0008.test.ts
 *
 * Verifies that migration 0008 is correctly defined and safe.
 * Does NOT apply the migration — purely file inspection tests.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SQL_PATH = path.resolve(
  __dirname,
  "../../../drizzle/0008_property-type-prefs.sql"
);
const JOURNAL_PATH = path.resolve(
  __dirname,
  "../../../drizzle/meta/_journal.json"
);

describe("migration-0008 file", () => {
  it("exists at the expected path", () => {
    expect(fs.existsSync(SQL_PATH)).toBe(true);
  });

  it("contains ADD COLUMN IF NOT EXISTS", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
  });

  it("contains property_type_preferences", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8");
    expect(sql).toContain("property_type_preferences");
  });

  it("contains jsonb (case-insensitive)", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8");
    expect(sql.toLowerCase()).toContain("jsonb");
  });

  it("does NOT contain DROP COLUMN", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8").toUpperCase();
    expect(sql).not.toContain("DROP COLUMN");
  });

  it("does NOT contain DROP TABLE", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8").toUpperCase();
    expect(sql).not.toContain("DROP TABLE");
  });

  it("does NOT contain target_property_type (must not touch existing column)", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8");
    expect(sql).not.toContain("target_property_type");
  });

  it("does NOT contain RENAME", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8").toUpperCase();
    expect(sql).not.toContain("RENAME");
  });

  it("does NOT contain ALTER COLUMN", () => {
    const sql = fs.readFileSync(SQL_PATH, "utf8").toUpperCase();
    expect(sql).not.toContain("ALTER COLUMN");
  });

  it("IF NOT EXISTS ensures idempotency", () => {
    // Confirmed by the ADD COLUMN IF NOT EXISTS check above
    const sql = fs.readFileSync(SQL_PATH, "utf8");
    expect(sql).toContain("IF NOT EXISTS");
  });
});

describe("migration-0008 journal registration", () => {
  it("_journal.json exists", () => {
    expect(fs.existsSync(JOURNAL_PATH)).toBe(true);
  });

  it("has entry at idx 8 with tag '0008_property-type-prefs'", () => {
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
    const entry = journal.entries.find(
      (e: { idx: number; tag: string }) => e.idx === 8
    );
    expect(entry).toBeDefined();
    expect(entry.tag).toBe("0008_property-type-prefs");
  });
});
