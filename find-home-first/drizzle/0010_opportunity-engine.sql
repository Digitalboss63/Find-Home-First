-- Property Opportunity Engine V1 — Migration 0010
-- Additive only. All statements use IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS "market_opportunity_scores" (
  "id"                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id"         uuid        NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "project_id"              uuid        NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "zip_code"                text        NOT NULL DEFAULT '',
  "rank"                    integer     NOT NULL DEFAULT 1,
  "veteran_need_index"      numeric(6,2),
  "veteran_need_score"      numeric(6,2),
  "placement_infra_index"   numeric(6,2),
  "placement_infra_score"   numeric(6,2),
  "housing_economics_index" numeric(6,2),
  "housing_economics_score" numeric(6,2),
  "property_avail_index"    numeric(6,2),
  "property_avail_score"    numeric(6,2),
  "opportunity_score"       integer     NOT NULL,
  "priority_level"          text        NOT NULL,
  "confidence_level"        text        NOT NULL,
  "source_geography"        text        NOT NULL,
  "source_geography_type"   text        NOT NULL,
  "is_estimated"            boolean     NOT NULL DEFAULT true,
  "recommendation"          text,
  "inputs_json"             text,
  "calculated_at"           timestamptz NOT NULL DEFAULT now(),
  "calculation_version"     text        NOT NULL DEFAULT 'FHF-OPPORTUNITY-V1'
);

CREATE INDEX IF NOT EXISTS "mos_org_idx"     ON "market_opportunity_scores" ("organization_id");
CREATE INDEX IF NOT EXISTS "mos_project_idx" ON "market_opportunity_scores" ("project_id");
CREATE INDEX IF NOT EXISTS "mos_zip_idx"     ON "market_opportunity_scores" ("zip_code");
CREATE INDEX IF NOT EXISTS "mos_score_idx"   ON "market_opportunity_scores" ("opportunity_score");
CREATE UNIQUE INDEX IF NOT EXISTS "mos_project_zip_ver_idx" ON "market_opportunity_scores" ("project_id", "zip_code", "calculation_version");
