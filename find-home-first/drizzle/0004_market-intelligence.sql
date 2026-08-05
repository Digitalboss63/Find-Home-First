-- Market Intelligence: job queue and versioned report snapshots
-- Safe to run multiple times (IF NOT EXISTS on all DDL).

CREATE TABLE IF NOT EXISTS market_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  triggered_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  sources_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mrj_org_idx ON market_research_jobs(organization_id);
CREATE INDEX IF NOT EXISTS mrj_project_idx ON market_research_jobs(project_id);
CREATE INDEX IF NOT EXISTS mrj_status_idx ON market_research_jobs(status);

CREATE TABLE IF NOT EXISTS market_research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_id UUID REFERENCES market_research_jobs(id) ON DELETE SET NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'complete',
  report_json TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_through_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mrr_org_idx ON market_research_reports(organization_id);
CREATE INDEX IF NOT EXISTS mrr_project_idx ON market_research_reports(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS mrr_project_version_idx ON market_research_reports(project_id, version);
