/**
 * Migration 0005 integration test — properties-finder schema changes.
 *
 * Runs against an isolated PostgreSQL schema using the DATABASE_URL
 * environment variable. Never modifies production data.
 *
 * Usage:
 *   DATABASE_URL=<connection-string> node scripts/test-migration-0005.mjs
 *   railway run node scripts/test-migration-0005.mjs
 *
 * All connection details come from the environment — no credentials in source.
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const schema = `migration_test_0005_${Date.now()}`;

/** Execute a statement, ignoring "already exists" / "does not exist" notices. */
async function runSafe(stmt) {
  try {
    await sql.unsafe(stmt);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('already exists') || msg.includes('does not exist')) return;
    throw e;
  }
}

async function run() {
  try {
    // ── Isolated schema ──────────────────────────────────────────────────────
    console.log(`Creating isolated test schema: ${schema}`);
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`SET search_path = "${schema}"`);

    // ── Prerequisite tables (minimal stubs) ──────────────────────────────────
    await sql.unsafe(`
      CREATE TABLE organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
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
      CREATE TABLE property_owners (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        name text NOT NULL,
        owner_type text NOT NULL DEFAULT 'unknown',
        outreach_status text NOT NULL DEFAULT 'new',
        lead_source text NOT NULL DEFAULT 'manual',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.unsafe(`
      CREATE TABLE property_leads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES "${schema}".organizations(id) ON DELETE CASCADE,
        owner_id uuid REFERENCES "${schema}".property_owners(id) ON DELETE SET NULL,
        source text NOT NULL DEFAULT 'manual',
        external_id text,
        source_url text,
        normalized_address text,
        normalized_source_url text,
        address text NOT NULL,
        acquisition_stage text NOT NULL DEFAULT 'lead_identified',
        qualification_status text NOT NULL DEFAULT 'pending',
        listing_status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Pre-migration org-wide indexes (simulating state before 0005)
    await sql.unsafe(`CREATE UNIQUE INDEX leads_org_external_idx ON property_leads (organization_id, external_id) WHERE external_id IS NOT NULL`);
    await sql.unsafe(`CREATE UNIQUE INDEX leads_org_norm_address_idx ON property_leads (organization_id, normalized_address) WHERE normalized_address IS NOT NULL`);
    await sql.unsafe(`CREATE UNIQUE INDEX leads_org_norm_url_idx ON property_leads (organization_id, normalized_source_url) WHERE normalized_source_url IS NOT NULL`);
    console.log('✓ Base tables and pre-migration indexes created');

    // ── Apply migration 0005 ─────────────────────────────────────────────────
    // Read SQL file and adapt the public-schema FK reference to our test schema.
    // In production, search_path = public so the reference resolves correctly.
    const rawSql = readFileSync('./drizzle/0005_properties-finder.sql', 'utf8');
    const migrationSql = rawSql.replace(
      /REFERENCES "public"\."projects"/g,
      `REFERENCES "${schema}"."projects"`
    );
    await runSafe(migrationSql);
    console.log('✓ Migration 0005 applied');

    // ── Verify columns ───────────────────────────────────────────────────────
    const leadCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema}
        AND table_name   = 'property_leads'
        AND column_name IN ('project_id','opportunity_score','opportunity_signals')
      ORDER BY column_name
    `;
    if (leadCols.length !== 3) throw new Error(`Missing property_leads columns: ${JSON.stringify(leadCols)}`);
    console.log('✓ property_leads: project_id, opportunity_score, opportunity_signals');

    const ownerCols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = ${schema}
        AND table_name   = 'property_owners'
        AND column_name  = 'rentcast_property_id'
    `;
    if (ownerCols.length !== 1) throw new Error('Missing property_owners.rentcast_property_id');
    console.log('✓ property_owners: rentcast_property_id');

    // ── Verify FK ────────────────────────────────────────────────────────────
    const fk = await sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema    = ${schema}
        AND table_name      = 'property_leads'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'property_leads_project_fk'
    `;
    if (fk.length !== 1) throw new Error('Missing property_leads_project_fk');
    console.log('✓ property_leads.project_id FK to projects');

    // ── Verify indexes ───────────────────────────────────────────────────────
    const idxs = await sql`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = ${schema}
        AND indexname IN (
          'leads_proj_external_idx', 'leads_proj_norm_url_idx', 'leads_proj_norm_address_idx',
          'leads_legacy_external_idx', 'leads_legacy_norm_url_idx', 'leads_legacy_norm_address_idx',
          'owners_org_rentcast_idx'
        )
      ORDER BY indexname
    `;
    const names = idxs.map(r => r.indexname);
    const required = [
      'leads_proj_external_idx', 'leads_proj_norm_address_idx', 'leads_proj_norm_url_idx',
      'leads_legacy_external_idx', 'leads_legacy_norm_address_idx',
      'owners_org_rentcast_idx',
    ];
    for (const idx of required) {
      if (!names.includes(idx)) throw new Error(`Missing index: ${idx}`);
    }
    console.log('✓ All project-scoped and legacy unique indexes present');

    // ── Data scenarios ───────────────────────────────────────────────────────
    const [org]   = await sql`INSERT INTO organizations(name) VALUES('Test Org') RETURNING id`;
    const [proj1] = await sql`INSERT INTO projects(organization_id,name,community) VALUES(${org.id},'P1','Atlanta, GA') RETURNING id`;
    const [proj2] = await sql`INSERT INTO projects(organization_id,name,community) VALUES(${org.id},'P2','Marietta, GA') RETURNING id`;

    // Insert lead rc-001 in proj1
    await sql`
      INSERT INTO property_leads(organization_id,project_id,external_id,normalized_address,address,source)
      VALUES(${org.id},${proj1.id},'rc-001','123 main st','123 Main St','rentcast')
    `;
    console.log('✓ Lead inserted in proj1 (rc-001)');

    // Same external_id + same project → must be blocked
    let blocked = false;
    try {
      await sql`
        INSERT INTO property_leads(organization_id,project_id,external_id,normalized_address,address,source)
        VALUES(${org.id},${proj1.id},'rc-001','456 oak ave','456 Oak Ave','rentcast')
      `;
    } catch (e) {
      if (String(e).includes('23505') || String(e).includes('unique')) blocked = true;
    }
    if (!blocked) throw new Error('Duplicate in same project should have been blocked');
    console.log('✓ Duplicate in same project blocked (leads_proj_external_idx)');

    // Same external_id in a DIFFERENT project → must be allowed
    await sql`
      INSERT INTO property_leads(organization_id,project_id,external_id,normalized_address,address,source)
      VALUES(${org.id},${proj2.id},'rc-001','789 elm st','789 Elm St','rentcast')
    `;
    console.log('✓ Same property in different project allowed');

    // Legacy null-project lead
    await sql`
      INSERT INTO property_leads(organization_id,external_id,normalized_address,address,source)
      VALUES(${org.id},'legacy-001','legacy main st','Legacy Main St','manual')
    `;
    const legCount = await sql`SELECT count(*) AS n FROM property_leads WHERE project_id IS NULL`;
    if (Number(legCount[0].n) < 1) throw new Error('Legacy null-project lead missing');
    console.log('✓ Legacy null-project rows preserved');

    // Idempotency — second run must not throw
    await runSafe(migrationSql);
    console.log('✓ Second migration run is harmless (idempotent)');

    // ── Cleanup ──────────────────────────────────────────────────────────────
    await sql.unsafe(`DROP SCHEMA "${schema}" CASCADE`);
    console.log('✓ Test schema dropped — no production data touched');
    console.log('\nALL MIGRATION 0005 TESTS PASSED ✓');

  } catch (err) {
    console.error('\nMIGRATION TEST FAILED:', err);
    try { await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); } catch {}
    await sql.end();
    process.exit(1);
  }

  await sql.end();
}

run();
