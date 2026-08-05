-- Properties Finder Phase 1
-- Safe: uses IF NOT EXISTS / IF EXISTS / DO...EXCEPTION throughout.
-- No destructive statements. Legacy null-project leads are preserved.

-- STEP 1: Add project_id to property_leads (nullable for legacy compat)
ALTER TABLE "property_leads" ADD COLUMN IF NOT EXISTS "project_id" uuid;
DO $$ BEGIN
  ALTER TABLE "property_leads" ADD CONSTRAINT "property_leads_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "leads_project_idx" ON "property_leads" ("project_id");

-- STEP 2: Add opportunity fields to property_leads
ALTER TABLE "property_leads" ADD COLUMN IF NOT EXISTS "opportunity_score" integer;
ALTER TABLE "property_leads" ADD COLUMN IF NOT EXISTS "opportunity_signals" text;

-- STEP 3: Add rentcast_property_id to property_owners (cache key)
ALTER TABLE "property_owners" ADD COLUMN IF NOT EXISTS "rentcast_property_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "owners_org_rentcast_idx"
  ON "property_owners" ("organization_id", "rentcast_property_id")
  WHERE "rentcast_property_id" IS NOT NULL;

-- STEP 4: Drop old org-wide dedup indexes on property_leads
DROP INDEX IF EXISTS "leads_org_external_idx";
DROP INDEX IF EXISTS "leads_org_norm_address_idx";
DROP INDEX IF EXISTS "leads_org_norm_url_idx";

-- STEP 5: Project-scoped partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "leads_proj_external_idx"
  ON "property_leads" ("organization_id", "project_id", "external_id")
  WHERE "project_id" IS NOT NULL AND "external_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_proj_norm_url_idx"
  ON "property_leads" ("organization_id", "project_id", "normalized_source_url")
  WHERE "project_id" IS NOT NULL AND "normalized_source_url" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_proj_norm_address_idx"
  ON "property_leads" ("organization_id", "project_id", "normalized_address")
  WHERE "project_id" IS NOT NULL AND "normalized_address" IS NOT NULL;

-- STEP 6: Legacy org-only dedup for null-project rows (backward compat)
CREATE UNIQUE INDEX IF NOT EXISTS "leads_legacy_external_idx"
  ON "property_leads" ("organization_id", "external_id")
  WHERE "project_id" IS NULL AND "external_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_legacy_norm_url_idx"
  ON "property_leads" ("organization_id", "normalized_source_url")
  WHERE "project_id" IS NULL AND "normalized_source_url" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "leads_legacy_norm_address_idx"
  ON "property_leads" ("organization_id", "normalized_address")
  WHERE "project_id" IS NULL AND "normalized_address" IS NOT NULL;
