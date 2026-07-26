-- Foundation correction: replace listing-aggregator model with owner-pipeline model
-- Data migration: COPY property_candidates → property_leads BEFORE DROP
-- All DDL uses IF NOT EXISTS / IF EXISTS / DO...EXCEPTION for idempotency
-- Compatible with PostgreSQL 14+ (Railway's supported versions)

-- STEP 1: Create property_owners
CREATE TABLE IF NOT EXISTS "property_owners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" text NOT NULL,
  "owner_type" text DEFAULT 'unknown' NOT NULL,
  "phone" text, "email" text, "mailing_address" text,
  "mailing_differs_from_property" boolean, "owner_occupied" boolean,
  "motivation_notes" text, "outreach_status" text DEFAULT 'new' NOT NULL,
  "last_contact_date" date, "next_follow_up_date" date, "last_response" text,
  "lead_source" text DEFAULT 'manual' NOT NULL, "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "property_owners" ADD CONSTRAINT "property_owners_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "owners_org_idx" ON "property_owners" ("organization_id");
CREATE INDEX IF NOT EXISTS "owners_status_idx" ON "property_owners" ("outreach_status");

-- STEP 2: Create property_leads (includes normalized dedup columns)
CREATE TABLE IF NOT EXISTS "property_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL, "owner_id" uuid,
  "source" text DEFAULT 'manual' NOT NULL,
  "external_id" text, "source_url" text,
  "normalized_address" text, "normalized_source_url" text,
  "address" text NOT NULL, "city" text, "state" text, "zip" text,
  "property_type" text, "bedrooms" integer,
  "bathrooms" numeric(3,1), "monthly_rent" numeric(10,2), "deposit" numeric(10,2),
  "utilities_status" text, "property_condition" text,
  "occupancy_status" text DEFAULT 'unknown',
  "listing_status" text DEFAULT 'active' NOT NULL,
  "listing_date" date, "last_seen_date" date, "days_on_market" integer,
  "listing_contact" text, "listing_phone" text, "listing_email" text,
  "acquisition_stage" text DEFAULT 'lead_identified' NOT NULL,
  "qualification_status" text DEFAULT 'pending' NOT NULL,
  "qualification_reason" text, "suitability_notes" text,
  "follow_up_date" date, "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "property_leads" ADD CONSTRAINT "property_leads_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "property_leads" ADD CONSTRAINT "property_leads_owner_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."property_owners"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "leads_org_idx" ON "property_leads" ("organization_id");
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "property_leads" ("acquisition_stage");
CREATE INDEX IF NOT EXISTS "leads_owner_idx" ON "property_leads" ("owner_id");
CREATE INDEX IF NOT EXISTS "leads_external_idx" ON "property_leads" ("external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_external_idx"
  ON "property_leads" ("organization_id", "external_id") WHERE "external_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_norm_address_idx"
  ON "property_leads" ("organization_id", "normalized_address") WHERE "normalized_address" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "leads_org_norm_url_idx"
  ON "property_leads" ("organization_id", "normalized_source_url") WHERE "normalized_source_url" IS NOT NULL;

-- STEP 3: DATA COPY property_candidates → property_leads (BEFORE DROP)
-- WHERE NOT EXISTS guard makes this idempotent
-- AND EXISTS guard skips the copy if property_candidates was already dropped
INSERT INTO "property_leads" (
  "organization_id", "source", "external_id", "source_url", "address",
  "city", "bedrooms", "bathrooms", "monthly_rent", "listing_status",
  "listing_date", "acquisition_stage", "normalized_address", "created_at", "updated_at"
)
SELECT
  pc."organization_id",
  COALESCE(pc."provider", 'manual'),
  pc."external_listing_id",
  pc."source_url",
  pc."address",
  pc."community",
  pc."bedrooms",
  pc."bathrooms",
  pc."monthly_rent",
  pc."listing_status",
  pc."available_date",
  'lead_identified',
  lower(regexp_replace(pc."address", '[^a-z0-9 ]', '', 'gi')),
  pc."created_at",
  pc."updated_at"
FROM "property_candidates" pc
WHERE NOT EXISTS (
  SELECT 1 FROM "property_leads" pl
  WHERE pl."organization_id" = pc."organization_id"
    AND pl."external_id" = pc."external_listing_id"
    AND pc."external_listing_id" IS NOT NULL
)
AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_candidates');

-- STEP 4: Create property_search_drafts (project_id NOT NULL)
CREATE TABLE IF NOT EXISTS "property_search_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "city" text DEFAULT '' NOT NULL, "state" text DEFAULT '' NOT NULL,
  "zip_code" text DEFAULT '' NOT NULL, "property_type" text DEFAULT '' NOT NULL,
  "min_bedrooms" text DEFAULT '' NOT NULL, "min_bathrooms" text DEFAULT '' NOT NULL,
  "max_rent" text DEFAULT '' NOT NULL, "max_days_listed" text DEFAULT '' NOT NULL,
  "listing_status" text DEFAULT 'active' NOT NULL,
  "submitted" boolean DEFAULT false NOT NULL,
  "last_search_at" timestamp with time zone,
  "results_snapshot" text, "results_count" integer DEFAULT 0 NOT NULL,
  "query_fingerprint" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "property_search_drafts" ADD CONSTRAINT "search_drafts_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "property_search_drafts" ADD CONSTRAINT "search_drafts_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "property_search_drafts" ADD CONSTRAINT "search_drafts_project_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "search_drafts_scope_idx"
  ON "property_search_drafts" ("organization_id", "user_id", "project_id");

-- STEP 5: Create platform_settings
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "setting_key" text NOT NULL, "value" text,
  "enabled" boolean DEFAULT false NOT NULL,
  "updated_by_clerk_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_settings_key_unique" UNIQUE ("setting_key")
);

-- STEP 6: Create audit_log
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_clerk_user_id" text, "actor_email" text,
  "event_type" text NOT NULL, "detail" text, "organization_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" ("actor_clerk_user_id");
CREATE INDEX IF NOT EXISTS "audit_log_event_idx" ON "audit_log" ("event_type");
CREATE INDEX IF NOT EXISTS "audit_log_org_idx" ON "audit_log" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_log_created_idx" ON "audit_log" ("created_at");

-- STEP 7: Alter properties table
-- DROP old FK constraints (from the listing-aggregator model)
-- DROP REASON: candidate_id referenced property_candidates which is being replaced by property_leads
-- DROP REASON: owner_contact_id mixed owner records with referral contacts; owners now have property_owners table
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_candidate_id_property_candidates_id_fk";
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_owner_contact_id_contacts_id_fk";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "candidate_id";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "owner_contact_id";
ALTER TABLE "properties" DROP COLUMN IF EXISTS "community";
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "owner_id" uuid;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "zip" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "property_type" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "deposit" numeric(10,2);
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "utilities_status" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "agreement_type" text;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "lease_start_date" date;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "lease_end_date" date;
DO $$ BEGIN
  ALTER TABLE "properties" ADD CONSTRAINT "properties_lead_fk"
    FOREIGN KEY ("lead_id") REFERENCES "public"."property_leads"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_fk"
    FOREIGN KEY ("owner_id") REFERENCES "public"."property_owners"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- STEP 8: Add next_action to projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "next_action" text;

-- STEP 9: DROP property_candidates (data already copied in STEP 3)
-- SAFE: all records copied to property_leads; FKs from properties dropped above
DROP TABLE IF EXISTS "property_candidates";
