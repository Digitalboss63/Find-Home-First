-- Map search state for Properties Finder Phase 2
-- Adds map center and radius to property_search_drafts.
-- Safe: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS only.
-- No destructive changes. All new columns are nullable.

ALTER TABLE "property_search_drafts"
  ADD COLUMN IF NOT EXISTS "map_latitude"  numeric(9,6),
  ADD COLUMN IF NOT EXISTS "map_longitude" numeric(9,6),
  ADD COLUMN IF NOT EXISTS "map_radius_mi" integer,
  ADD COLUMN IF NOT EXISTS "map_mode"      text DEFAULT 'list';
