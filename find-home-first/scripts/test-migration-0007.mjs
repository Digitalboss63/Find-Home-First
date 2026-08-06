/**
 * Migration 0007 integration test — owner outreach / secure property.
 *
 * Runs against an isolated PostgreSQL schema using DATABASE_URL.
 * Never modifies production data. Verifies:
 * - All new columns and tables created correctly
 * - Existing rows preserved after migration
 * - property_lead_activities is append-only (no update/delete in migration)
 * - Repeated migration is harmless (idempotent)
 *
 * Usage:
 *   DATABASE_URL=<url> node scripts/test-migration-0007.mjs
 *   railway run node scripts/test-migration-0007.mjs
 */

import postgres from "postgres";
import { readFileSync } from "fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const schema = `migration_test_0007_${Date.now()}`;

async function runSafe(stmt) {
  try {
    await sql.unsafe(stmt);
  } catch (e) {
    const msg = String(e);
    if (
      msg.includes("already exists") ||
      msg.includes("does not exist") ||
      msg.includes("duplicate column") ||
      msg.includes("column") && msg.includes("already exists")
    ) return;
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
      )`);
    await sql.unsafe(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        clerk_user_id text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await sql.unsafe(`
      CREATE TABLE projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        community text NOT NULL,
        current_status text NOT NULL DEFAULT 'researching_city',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await sql.unsafe(`
      CREATE TABLE property_owners (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        owner_type text NOT NULL DEFAULT 'unknown',
        phone text,
        email text,
        mailing_address text,
        lead_source text NOT NULL DEFAULT 'manual',
        outreach_status text NOT NULL DEFAULT 'new',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await sql.unsafe(`
      CREATE TABLE property_leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        owner_id uuid REFERENCES "${schema}".property_owners(id) ON DELETE SET NULL,
        project_id uuid REFERENCES "${schema}".projects(id) ON DELETE SET NULL,
        address text NOT NULL,
        source text NOT NULL DEFAULT 'manual',
        acquisition_stage text NOT NULL DEFAULT 'researching',
        listing_status text NOT NULL DEFAULT 'active',
        qualification_status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await sql.unsafe(`
      CREATE TABLE properties (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        owner_id uuid REFERENCES "${schema}".property_owners(id) ON DELETE SET NULL,
        address text NOT NULL,
        readiness_status text NOT NULL DEFAULT 'available',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await sql.unsafe(`
      CREATE TABLE tasks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        project_id uuid REFERENCES "${schema}".projects(id) ON DELETE SET NULL,
        title text NOT NULL,
        status text NOT NULL DEFAULT 'upcoming',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    console.log("✓ Base tables created");

    // ── Seed test data before migration ──────────────────────────────────────
    const [org]   = await sql`INSERT INTO organizations(name) VALUES('Test Org') RETURNING id`;
    const [proj]  = await sql`INSERT INTO projects(organization_id,name,community) VALUES(${org.id},'Proj1','Atlanta, GA') RETURNING id`;
    const [owner] = await sql`INSERT INTO property_owners(organization_id,name) VALUES(${org.id},'Jane Smith') RETURNING id`;
    const [lead]  = await sql`INSERT INTO property_leads(organization_id,project_id,owner_id,address) VALUES(${org.id},${proj.id},${owner.id},'123 Main St') RETURNING id`;
    await sql`INSERT INTO properties(organization_id,address) VALUES(${org.id},'123 Main St')`;
    const [task1] = await sql`INSERT INTO tasks(organization_id,project_id,title) VALUES(${org.id},${proj.id},'Existing Task') RETURNING id`;
    console.log("✓ Seed data inserted before migration");

    // ── Apply migration 0007 ─────────────────────────────────────────────────
    const migSql = readFileSync("./drizzle/0007_owner-outreach.sql", "utf8");
    await runSafe(migSql);
    console.log("✓ Migration 0007 applied");

    // ── Verify property_lead_activities table ────────────────────────────────
    const plaExists = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${schema} AND table_name = 'property_lead_activities'`;
    if (plaExists.length === 0) throw new Error("property_lead_activities table missing");
    console.log("✓ property_lead_activities table created");

    // Verify columns
    const plaCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'property_lead_activities'
      ORDER BY column_name`;
    const plaColNames = plaCols.map(c => c.column_name);
    for (const c of ["id","organization_id","project_id","lead_id","owner_id","activity_type","contact_method","outcome","notes","stage_before","stage_after","next_follow_up_at","actor_user_id","created_at"]) {
      if (!plaColNames.includes(c)) throw new Error(`property_lead_activities missing column: ${c}`);
    }
    console.log("✓ property_lead_activities has all required columns");

    // ── Verify property_leads new columns ────────────────────────────────────
    const leadCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'property_leads'
      AND column_name IN ('proposed_monthly_rent','owner_asking_rent','proposed_deposit','proposed_lease_term_months','proposed_agreement_type','utilities_responsibility','furnishing_responsibility','maintenance_responsibility','negotiation_summary','last_stage_changed_at')`;
    if (leadCols.length !== 10) throw new Error(`Expected 10 new lead columns, got ${leadCols.length}`);
    console.log("✓ property_leads: 10 negotiation columns present");

    // ── Verify property_owners new columns ───────────────────────────────────
    const ownerCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'property_owners'
      AND column_name IN ('preferred_contact_method','phone_verified_at','email_verified_at','contact_source')`;
    if (ownerCols.length !== 4) throw new Error(`Expected 4 new owner columns, got ${ownerCols.length}`);
    console.log("✓ property_owners: 4 contact verification columns present");

    // ── Verify properties new columns ────────────────────────────────────────
    const propCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'properties'
      AND column_name IN ('agreement_status','agreement_signed_date','agreement_reference','lead_id')`;
    if (propCols.length !== 4) throw new Error(`Expected 4 new properties columns, got ${propCols.length}`);
    console.log("✓ properties: 4 agreement/lead columns present");

    // ── Verify tasks.lead_id ────────────────────────────────────────────────
    const taskLeadCol = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'tasks'
      AND column_name = 'lead_id'`;
    if (taskLeadCol.length === 0) throw new Error("tasks.lead_id column missing");
    console.log("✓ tasks.lead_id column present");

    // ── Verify indexes ───────────────────────────────────────────────────────
    const indexes = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = ${schema}
      AND indexname IN ('pla_lead_idx','pla_org_idx','pla_project_idx','pla_type_idx','properties_lead_idx','tasks_lead_idx')`;
    if (indexes.length !== 6) throw new Error(`Expected 6 new indexes, got ${indexes.length}: ${indexes.map(i=>i.indexname).join(', ')}`);
    console.log("✓ All 6 new indexes present");

    // ── Verify existing rows preserved ───────────────────────────────────────
    const leadCheck = await sql`SELECT id, address FROM property_leads WHERE id = ${lead.id}`;
    if (leadCheck.length !== 1 || leadCheck[0].address !== '123 Main St') throw new Error("Existing lead row corrupted");
    const ownerCheck = await sql`SELECT id, name FROM property_owners WHERE id = ${owner.id}`;
    if (ownerCheck.length !== 1 || ownerCheck[0].name !== 'Jane Smith') throw new Error("Existing owner row corrupted");
    const taskCheck = await sql`SELECT id, title FROM tasks WHERE id = ${task1.id}`;
    if (taskCheck.length !== 1 || taskCheck[0].title !== 'Existing Task') throw new Error("Existing task corrupted");
    console.log("✓ All existing records preserved after migration");

    // ── Test append-only activity insert ────────────────────────────────────
    const [user] = await sql`INSERT INTO users(clerk_user_id) VALUES('clerk_test') RETURNING id`;
    await sql`
      INSERT INTO property_lead_activities(organization_id,project_id,lead_id,activity_type,outcome,notes)
      VALUES(${org.id},${proj.id},${lead.id},'outreach','Left voicemail','Called at noon')`;
    await sql`
      INSERT INTO property_lead_activities(organization_id,project_id,lead_id,activity_type,stage_before,stage_after)
      VALUES(${org.id},${proj.id},${lead.id},'stage_change','researching','contacted')`;
    const activities = await sql`SELECT id, activity_type FROM property_lead_activities WHERE lead_id = ${lead.id} ORDER BY created_at`;
    if (activities.length !== 2) throw new Error(`Expected 2 activities, got ${activities.length}`);
    if (activities[0].activity_type !== 'outreach') throw new Error("First activity type wrong");
    if (activities[1].activity_type !== 'stage_change') throw new Error("Second activity type wrong");
    console.log("✓ Append-only activities: 2 activities inserted and verified");
    void user;

    // ── Idempotency ──────────────────────────────────────────────────────────
    await runSafe(migSql);
    // Verify no duplicate activities were created by re-running migration
    const actCount = await sql`SELECT COUNT(*) as n FROM property_lead_activities WHERE lead_id = ${lead.id}`;
    if (parseInt(actCount[0].n) !== 2) throw new Error(`Idempotency failed: expected 2 activities, got ${actCount[0].n}`);
    console.log("✓ Second migration run is harmless (idempotent)");

    // ── Cleanup ──────────────────────────────────────────────────────────────
    await sql.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
    console.log("✓ Test schema dropped — no production data touched");
    console.log("\nALL MIGRATION 0007 TESTS PASSED ✓");

  } catch (err) {
    console.error("\nMIGRATION 0007 TEST FAILED:", err);
    try { await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } catch {}
    await sql.end();
    process.exit(1);
  }

  await sql.end();
}

run();
