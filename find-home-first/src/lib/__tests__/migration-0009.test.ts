import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0009_referral-partners.sql"), "utf8");

describe("migration 0009 referral partners", () => {
  it("creates the project-scoped referral partner table", () => {
    expect(migration).toContain('CREATE TABLE "referral_partner_candidates"');
    expect(migration).toContain('"project_id" uuid NOT NULL');
    expect(migration).toContain('"organization_id" uuid NOT NULL');
  });
  it("preserves source and qualification evidence", () => {
    for (const column of ["source_url", "source_agency", "source_date", "verification_status", "referral_capacity_status", "eligibility_status"]) {
      expect(migration).toContain(`"${column}"`);
    }
  });
  it("has a project-scoped deduplication index", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "rpc_project_org_program_idx"');
  });
  it("does not drop or alter an existing application table", () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)/i);
    expect(migration).not.toMatch(/ALTER TABLE "(projects|contacts|residents|properties|property_leads|property_lead_activities)"/i);
  });
});
