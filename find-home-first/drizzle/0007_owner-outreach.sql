-- Owner Outreach → Secure Property — Migration 0007
-- Drizzle-kit snapshot updated to 0007; this SQL is the additive-only portion.
-- All statements are idempotent: every ALTER uses IF NOT EXISTS guards.

-- ─── property_leads: negotiation fields ──────────────────────────────────────
ALTER TABLE "property_leads"
  ADD COLUMN IF NOT EXISTS "proposed_monthly_rent"     numeric(10,2),
  ADD COLUMN IF NOT EXISTS "owner_asking_rent"          numeric(10,2),
  ADD COLUMN IF NOT EXISTS "proposed_deposit"           numeric(10,2),
  ADD COLUMN IF NOT EXISTS "proposed_lease_term_months" integer,
  ADD COLUMN IF NOT EXISTS "proposed_agreement_type"    text,
  ADD COLUMN IF NOT EXISTS "utilities_responsibility"   text,
  ADD COLUMN IF NOT EXISTS "furnishing_responsibility"  text,
  ADD COLUMN IF NOT EXISTS "maintenance_responsibility" text,
  ADD COLUMN IF NOT EXISTS "negotiation_summary"        text,
  ADD COLUMN IF NOT EXISTS "last_stage_changed_at"      timestamptz;

-- ─── property_owners: contact verification fields ────────────────────────────
ALTER TABLE "property_owners"
  ADD COLUMN IF NOT EXISTS "preferred_contact_method" text,
  ADD COLUMN IF NOT EXISTS "phone_verified_at"        timestamptz,
  ADD COLUMN IF NOT EXISTS "email_verified_at"        timestamptz,
  ADD COLUMN IF NOT EXISTS "contact_source"           text;

-- ─── properties: agreement fields + lead FK ──────────────────────────────────
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "agreement_status"      text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "agreement_signed_date" date,
  ADD COLUMN IF NOT EXISTS "agreement_reference"   text,
  ADD COLUMN IF NOT EXISTS "lead_id"               uuid REFERENCES "property_leads"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "properties_lead_idx" ON "properties" ("lead_id");

-- ─── tasks: lead FK ───────────────────────────────────────────────────────────
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "lead_id" uuid REFERENCES "property_leads"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "tasks_lead_idx" ON "tasks" ("lead_id");

-- ─── property_lead_activities: append-only outreach/stage/negotiation log ────
CREATE TABLE IF NOT EXISTS "property_lead_activities" (
  "id"              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid        NOT NULL REFERENCES "organizations"("id")     ON DELETE CASCADE,
  "project_id"      uuid        NOT NULL REFERENCES "projects"("id")          ON DELETE CASCADE,
  "lead_id"         uuid        NOT NULL REFERENCES "property_leads"("id")    ON DELETE CASCADE,
  "owner_id"        uuid                 REFERENCES "property_owners"("id")   ON DELETE SET NULL,
  "activity_type"   text        NOT NULL,
  "contact_method"  text,
  "outcome"         text,
  "notes"           text,
  "stage_before"    text,
  "stage_after"     text,
  "next_follow_up_at" date,
  "actor_user_id"   uuid                 REFERENCES "users"("id")             ON DELETE SET NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pla_lead_idx"    ON "property_lead_activities" ("lead_id");
CREATE INDEX IF NOT EXISTS "pla_org_idx"     ON "property_lead_activities" ("organization_id");
CREATE INDEX IF NOT EXISTS "pla_project_idx" ON "property_lead_activities" ("project_id");
CREATE INDEX IF NOT EXISTS "pla_type_idx"    ON "property_lead_activities" ("activity_type");
