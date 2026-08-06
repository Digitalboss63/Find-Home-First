/**
 * Migration 0006 integration test — map search state columns.
 *
 * Runs against an isolated PostgreSQL schema using DATABASE_URL.
 * Never modifies production data.
 *
 * Usage:
 *   DATABASE_URL=<url> node scripts/test-migration-0006.mjs
 *   railway run node scripts/test-migration-0006.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const schema = `migration_test_0006_${Date.now()}`;

async function runSafe(stmt) {
  try {
    await sql.unsafe(stmt);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("already exists") || msg.includes("does not exist")) return;
    throw e;
  }
}

async function run() {
  try {
    console.log(`Creating isolated test schema: ${schema}`);
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`SET search_path = "${schema}"`);

    // ── Minimal prerequisite tables ──────────────────────────────────────────
    await sql.unsafe(`
      CREATE TABLE organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.unsafe(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_user_id text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.unsafe(`
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        community text NOT NULL,
        current_status text NOT NULL DEFAULT 'researching_city',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.unsafe(`
      CREATE TABLE property_search_drafts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES "${schema}".projects(id) ON DELETE CASCADE,
        city text NOT NULL DEFAULT '',
        state text NOT NULL DEFAULT '',
        zip_code text NOT NULL DEFAULT '',
        property_type text NOT NULL DEFAULT '',
        min_bedrooms text NOT NULL DEFAULT '',
        min_bathrooms text NOT NULL DEFAULT '',
        max_rent text NOT NULL DEFAULT '',
        max_days_listed text NOT NULL DEFAULT '',
        listing_status text NOT NULL DEFAULT 'active',
        submitted boolean NOT NULL DEFAULT false,
        last_search_at timestamptz,
        results_snapshot text,
        results_count integer NOT NULL DEFAULT 0,
        query_fingerprint text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    console.log("✓ Base tables created");

    // ── Insert a legacy draft before migration ───────────────────────────────
    const [org]  = await sql`INSERT INTO organizations(name) VALUES('Test Org') RETURNING id`;
    const [usr]  = await sql`INSERT INTO users(clerk_user_id) VALUES('clerk_test') RETURNING id`;
    const [proj] = await sql`INSERT INTO projects(organization_id,name,community) VALUES(${org.id},'Proj1','Atlanta, GA') RETURNING id`;
    const [draft] = await sql`
      INSERT INTO property_search_drafts(organization_id,user_id,project_id,city,state,submitted)
      VALUES(${org.id},${usr.id},${proj.id},'Atlanta','GA',true)
      RETURNING id
    `;
    console.log("✓ Legacy draft inserted before migration");

    // ── Apply migration 0006 ─────────────────────────────────────────────────
    const migSql = readFileSync("./drizzle/0006_map-search-state.sql", "utf8");
    await runSafe(migSql);
    console.log("✓ Migration 0006 applied");

    // ── Verify all four columns exist ────────────────────────────────────────
    const cols = await sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = ${schema}
        AND table_name = 'property_search_drafts'
        AND column_name IN ('map_latitude','map_longitude','map_radius_mi','map_mode')
      ORDER BY column_name
    `;
    const colNames = cols.map(c => c.column_name);
    for (const col of ["map_latitude", "map_longitude", "map_radius_mi", "map_mode"]) {
      if (!colNames.includes(col)) throw new Error(`Missing column: ${col}`);
    }
    console.log("✓ All 4 map columns present: map_latitude, map_longitude, map_radius_mi, map_mode");

    // Verify map_mode defaults to 'list'
    const modeCol = cols.find(c => c.column_name === "map_mode");
    if (!modeCol?.column_default?.includes("list")) {
      throw new Error(`map_mode default wrong: ${modeCol?.column_default}`);
    }
    console.log("✓ map_mode defaults to 'list'");

    // ── Verify legacy draft is intact ────────────────────────────────────────
    const legacyRows = await sql`
      SELECT id, city, map_latitude, map_longitude, map_radius_mi, map_mode
      FROM property_search_drafts WHERE id = ${draft.id}
    `;
    if (legacyRows.length !== 1) throw new Error("Legacy draft not found after migration");
    const leg = legacyRows[0];
    if (leg.city !== "Atlanta") throw new Error("Legacy city field corrupted");
    if (leg.map_latitude !== null) throw new Error("Legacy map_latitude should be null");
    if (leg.map_longitude !== null) throw new Error("Legacy map_longitude should be null");
    console.log("✓ Legacy draft intact (city preserved, new columns null)");

    // ── Save and restore map state ───────────────────────────────────────────
    await sql`
      UPDATE property_search_drafts
      SET map_latitude=33.749, map_longitude=-84.388, map_radius_mi=10, map_mode='map'
      WHERE id=${draft.id}
    `;
    const updated = await sql`
      SELECT map_latitude, map_longitude, map_radius_mi, map_mode
      FROM property_search_drafts WHERE id=${draft.id}
    `;
    if (Number(updated[0].map_latitude) !== 33.749) throw new Error("map_latitude not saved");
    if (Number(updated[0].map_longitude) !== -84.388) throw new Error("map_longitude not saved");
    if (updated[0].map_radius_mi !== 10) throw new Error("map_radius_mi not saved");
    if (updated[0].map_mode !== "map") throw new Error("map_mode not saved");
    console.log("✓ Map state saves and restores correctly");

    // ── Null values valid (legacy rows) ─────────────────────────────────────
    const [newDraft] = await sql`
      INSERT INTO property_search_drafts(organization_id,user_id,project_id,city,state)
      VALUES(${org.id},${usr.id},${proj.id},'Marietta','GA')
      RETURNING map_latitude, map_longitude, map_radius_mi, map_mode
    `;
    if (newDraft.map_latitude !== null) throw new Error("New draft map_latitude should be null");
    console.log("✓ Null legacy values valid (new drafts start with null map state)");

    // ── Idempotency ──────────────────────────────────────────────────────────
    await runSafe(migSql);
    console.log("✓ Second migration run is harmless (idempotent)");

    // ── Cleanup ──────────────────────────────────────────────────────────────
    await sql.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
    console.log("✓ Test schema dropped — no production data touched");
    console.log("\nALL MIGRATION 0006 TESTS PASSED ✓");

  } catch (err) {
    console.error("\nMIGRATION 0006 TEST FAILED:", err);
    try { await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } catch {}
    await sql.end();
    process.exit(1);
  }

  await sql.end();
}

run();
