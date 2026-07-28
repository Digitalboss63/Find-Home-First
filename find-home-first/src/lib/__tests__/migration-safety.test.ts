/**
 * Migration safety tests — static file analysis only. No DB connection needed.
 *
 * Verifies that drizzle/0002_foundation-correction.sql:
 * 1. Contains INSERT INTO property_leads SELECT FROM property_candidates BEFORE DROP
 * 2. DROP TABLE uses IF EXISTS
 * 3. All CREATE TABLE statements use IF NOT EXISTS
 * 4. WHERE NOT EXISTS guard is present in the data copy
 * 5. DROP comes after the INSERT...SELECT in line numbers
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Find the migration file in the drizzle directory
function findMigrationFile(): string {
  const drizzleDir = join(process.cwd(), "drizzle");
  const files = readdirSync(drizzleDir);
  const file = files.find((f) => f.includes("foundation-correction") && f.endsWith(".sql"));
  if (!file) {
    throw new Error(
      `Could not find foundation-correction migration in ${drizzleDir}. Files: ${files.join(", ")}`
    );
  }
  return join(drizzleDir, file);
}

const migrationPath = findMigrationFile();
const migrationSql = readFileSync(migrationPath, "utf-8");
const lines = migrationSql.split("\n");

function lineNumberOf(pattern: RegExp): number {
  const idx = lines.findIndex((line) => pattern.test(line));
  return idx; // -1 if not found
}

describe("Migration safety — foundation-correction.sql", () => {
  it("contains INSERT INTO property_leads SELECT FROM property_candidates", () => {
    const hasInsert = /INSERT INTO "property_leads"/i.test(migrationSql);
    const hasSelect = /FROM "property_candidates"/i.test(migrationSql);
    expect(hasInsert).toBe(true);
    expect(hasSelect).toBe(true);
  });

  it("INSERT INTO property_leads appears before DROP TABLE property_candidates", () => {
    const insertLine = lineNumberOf(/INSERT INTO "property_leads"/i);
    const dropLine = lineNumberOf(/DROP TABLE IF EXISTS "property_candidates"/i);
    expect(insertLine).toBeGreaterThan(-1);
    expect(dropLine).toBeGreaterThan(-1);
    expect(insertLine).toBeLessThan(dropLine);
  });

  it("DROP TABLE uses IF EXISTS", () => {
    // All DROP TABLE statements must use IF EXISTS
    const dropStatements = lines.filter((line) => /DROP TABLE/i.test(line));
    expect(dropStatements.length).toBeGreaterThan(0);
    for (const stmt of dropStatements) {
      expect(stmt).toMatch(/DROP TABLE IF EXISTS/i);
    }
  });

  it("all CREATE TABLE statements use IF NOT EXISTS", () => {
    const createStatements = lines.filter((line) => /CREATE TABLE/i.test(line));
    expect(createStatements.length).toBeGreaterThan(0);
    for (const stmt of createStatements) {
      expect(stmt).toMatch(/CREATE TABLE IF NOT EXISTS/i);
    }
  });

  it("WHERE NOT EXISTS guard is present in the data copy", () => {
    expect(migrationSql).toMatch(/WHERE NOT EXISTS/i);
  });

  it("DROP comes after the INSERT...SELECT in line numbers", () => {
    const insertLine = lineNumberOf(/INSERT INTO "property_leads"/i);
    const dropLine = lineNumberOf(/DROP TABLE IF EXISTS "property_candidates"/i);
    expect(dropLine).toBeGreaterThan(insertLine);
  });

  it("migration file is non-empty", () => {
    expect(migrationSql.trim().length).toBeGreaterThan(100);
  });

  it("contains CREATE TABLE for property_owners", () => {
    expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS "property_owners"/i);
  });

  it("contains CREATE TABLE for property_leads", () => {
    expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS "property_leads"/i);
  });

  it("contains CREATE TABLE for property_search_drafts with project_id NOT NULL", () => {
    expect(migrationSql).toMatch(/CREATE TABLE IF NOT EXISTS "property_search_drafts"/i);
    // project_id should NOT be nullable (no default null, must appear before other fields)
    expect(migrationSql).toMatch(/"project_id" uuid NOT NULL/i);
  });
});

describe("Migration safety — 0003_market-research.sql", () => {
  it("file exists", () => {
    const drizzleDir = join(process.cwd(), "drizzle");
    const files = readdirSync(drizzleDir);
    const file = files.find((f) => f.includes("market-research") && f.endsWith(".sql"));
    expect(file).toBeTruthy();
  });

  it("contains CREATE TABLE IF NOT EXISTS project_market_research", () => {
    const drizzleDir = join(process.cwd(), "drizzle");
    const sql = readFileSync(join(drizzleDir, "0003_market-research.sql"), "utf-8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "project_market_research"/i);
  });

  it("contains UNIQUE INDEX for project_id", () => {
    const drizzleDir = join(process.cwd(), "drizzle");
    const sql = readFileSync(join(drizzleDir, "0003_market-research.sql"), "utf-8");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS/i);
    expect(sql).toMatch(/"project_id"/i);
  });

  it("contains no DROP TABLE statements", () => {
    const drizzleDir = join(process.cwd(), "drizzle");
    const sql = readFileSync(join(drizzleDir, "0003_market-research.sql"), "utf-8");
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it("contains organization_id NOT NULL with CASCADE", () => {
    const drizzleDir = join(process.cwd(), "drizzle");
    const sql = readFileSync(join(drizzleDir, "0003_market-research.sql"), "utf-8");
    expect(sql).toMatch(/"organization_id" uuid NOT NULL/i);
    expect(sql).toMatch(/ON DELETE CASCADE/i);
  });
});
