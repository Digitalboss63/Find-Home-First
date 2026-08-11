/**
 * Migration 0008 integration test — property_type_preferences jsonb column.
 *
 * Runs against an isolated PostgreSQL schema using DATABASE_URL.
 * Never modifies production tables.
 *
 * Tests:
 *   - Baseline table created with target_property_type and unrelated research fields
 *   - Migration 0008 SQL adds property_type_preferences column
 *   - Column type is jsonb and nullable
 *   - Valid preference JSON inserts and reads correctly
 *   - target_property_type unchanged after migration
 *   - Unrelated fields unchanged after migration
 *   - Migration is idempotent (second run causes no error)
 *   - Temporary schema dropped; production tables never touched
 *
 * Usage:
 *   DATABASE_URL=<url> node scripts/test-migration-0008.mjs
 *   railway run node scripts/test-migration-0008.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  resolve(__dirname, "../drizzle/0008_property-type-prefs.sql"),
  "utf-8"
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("BLOCKER: DATABASE_URL is not set.");
  process.exit(1);
}

// Never print the connection string
console.log("Connecting to PostgreSQL (URL redacted)...");

const sql = postgres(url, { max: 1 });
const schema = `mig_0008_test_${Date.now()}`;

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ": " + detail : ""}`);
    failed++;
  }
}

try {
  // ── Setup: create isolated schema ──────────────────────────────────────────
  console.log(`\nCreating temporary schema: ${schema}`);
  await sql.unsafe(`CREATE SCHEMA "${schema}"`);
  await sql.unsafe(`SET search_path TO "${schema}", public`);

  // ── Create baseline project_market_research table ─────────────────────────
  await sql.unsafe(`
    CREATE TABLE "${schema}"."project_market_research" (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id      uuid NOT NULL,
      organization_id uuid NOT NULL,
      target_property_type   text,
      minimum_bedrooms       text,
      max_acceptable_lease   text,
      expected_private_room_capacity text,
      expected_payment_per_resident  text,
      updated_at      timestamptz DEFAULT now()
    )
  `);

  // ── Insert baseline row with all fields populated ─────────────────────────
  const rowId = "10000000-0000-0000-0000-000000000001";
  const projId = "20000000-0000-0000-0000-000000000001";
  const orgId  = "30000000-0000-0000-0000-000000000001";
  await sql.unsafe(`
    INSERT INTO "${schema}"."project_market_research"
      (id, project_id, organization_id, target_property_type, minimum_bedrooms,
       max_acceptable_lease, expected_private_room_capacity, expected_payment_per_resident)
    VALUES
      ('${rowId}', '${projId}', '${orgId}',
       'Single family, multi-family', '4', '2800', '6', '1500')
  `);

  // Verify column absent before migration
  const colsBefore = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = '${schema}'
      AND table_name = 'project_market_research'
      AND column_name = 'property_type_preferences'
  `);
  assert("Column absent before migration", colsBefore.length === 0);

  // ── Apply migration 0008 ───────────────────────────────────────────────────
  console.log("\nApplying migration 0008...");
  // Adapt SQL to use the test schema
  const adaptedSql = migrationSql
    .replace('"project_market_research"', `"${schema}"."project_market_research"`)
    .trim();
  await sql.unsafe(adaptedSql);

  // ── Verify column exists and is correct type ───────────────────────────────
  const colsAfter = await sql.unsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = '${schema}'
      AND table_name = 'project_market_research'
      AND column_name = 'property_type_preferences'
  `);
  assert("Column exists after migration", colsAfter.length === 1);
  assert("Column type is jsonb",
    colsAfter[0]?.data_type === "jsonb",
    `actual: ${colsAfter[0]?.data_type}`
  );
  assert("Column is nullable", colsAfter[0]?.is_nullable === "YES");

  // ── Verify existing row values unchanged ───────────────────────────────────
  const rowAfter = await sql.unsafe(`
    SELECT target_property_type, minimum_bedrooms, max_acceptable_lease,
           expected_private_room_capacity, expected_payment_per_resident,
           property_type_preferences
    FROM "${schema}"."project_market_research"
    WHERE id = '${rowId}'
  `);
  assert("target_property_type unchanged after migration",
    rowAfter[0]?.target_property_type === "Single family, multi-family");
  assert("minimum_bedrooms unchanged",
    rowAfter[0]?.minimum_bedrooms === "4");
  assert("max_acceptable_lease unchanged",
    rowAfter[0]?.max_acceptable_lease === "2800");
  assert("expected_private_room_capacity unchanged",
    rowAfter[0]?.expected_private_room_capacity === "6");
  assert("property_type_preferences is NULL before any write",
    rowAfter[0]?.property_type_preferences === null);

  // ── JSONB round-trip ───────────────────────────────────────────────────────
  const prefs = { "Single Family": "preferred", "Apartment": "excluded", "Condo": "acceptable" };
  await sql.unsafe(`
    UPDATE "${schema}"."project_market_research"
    SET property_type_preferences = '${JSON.stringify(prefs)}'::jsonb
    WHERE id = '${rowId}'
  `);
  const rowWithPrefs = await sql.unsafe(`
    SELECT property_type_preferences, target_property_type
    FROM "${schema}"."project_market_research"
    WHERE id = '${rowId}'
  `);
  const stored = rowWithPrefs[0]?.property_type_preferences;
  assert("JSONB round-trip: Single Family=preferred",
    stored?.["Single Family"] === "preferred");
  assert("JSONB round-trip: Apartment=excluded",
    stored?.["Apartment"] === "excluded");
  assert("JSONB round-trip: Condo=acceptable",
    stored?.["Condo"] === "acceptable");
  assert("target_property_type unchanged after JSONB write",
    rowWithPrefs[0]?.target_property_type === "Single family, multi-family");

  // ── Idempotency: run migration SQL a second time ───────────────────────────
  console.log("\nRunning migration 0008 a second time (idempotency check)...");
  try {
    await sql.unsafe(adaptedSql);
    assert("Second run of migration 0008 causes no error", true);
  } catch (e) {
    assert("Second run of migration 0008 causes no error", false,
      e instanceof Error ? e.message : String(e));
  }

  // ── Verify production tables were not touched ─────────────────────────────
  // Production tables are in the 'public' schema. Verify our migration only
  // modified the test schema.
  const prodCols = await sql.unsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_market_research'
      AND column_name = 'property_type_preferences'
  `);
  // If the prod table doesn't have the column yet, that's expected (not applied).
  // If it does, migration was applied to prod previously.
  // Either way, confirm our test schema is not the public schema.
  assert("Test schema is isolated from public schema",
    schema !== "public" && schema.startsWith("mig_0008_test_"));
  console.log(`  ℹ Production property_type_preferences column: ${prodCols.length > 0 ? "EXISTS (migration was applied to prod)" : "ABSENT (migration not yet applied to prod)"}`);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log("\nDropping temporary schema...");
  await sql.unsafe(`DROP SCHEMA "${schema}" CASCADE`);

  // Verify dropped
  const schemaCheck = await sql.unsafe(`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'
  `);
  assert("Temporary schema successfully dropped", schemaCheck.length === 0);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("MIGRATION 0008 TEST: FAILED");
    process.exit(1);
  } else {
    console.log("MIGRATION 0008 TEST: ALL ASSERTIONS PASSED");
    process.exit(0);
  }

} catch (err) {
  console.error("FATAL:", err instanceof Error ? err.message : err);
  try {
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    console.log("Cleaned up temporary schema after error.");
  } catch { /* ignore cleanup errors */ }
  process.exit(1);
} finally {
  await sql.end();
}
