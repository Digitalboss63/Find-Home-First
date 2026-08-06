/**
 * /housing-search — Property Lead Search
 *
 * Requires a ?project= query param containing a valid projectId.
 * Without one, shows the project selector.
 *
 * Research gate: projects at "Researching City" status cannot search.
 * Eligible statuses: city_approved, finding_property, contacting_owner,
 * application_in_progress, property_approved, preparing_property.
 *
 * Powered by the RentCast API (server-side, key never exposed to client).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { requireOrganization } from "@/lib/auth";
import {
  getPropertySearchDraft,
  listProjectLeads,
  listActiveProjects,
  projectBelongsToOrg,
  getProjectById,
  getMarketResearch,
  isDemoAllowed,
} from "@/lib/repository";
import { getLatestReport } from "@/lib/repository-intelligence";
import { getDb } from "@/db/client";
import { isRentCastConfigured } from "@/lib/rentcast";
import type { PropertySearchDraftView } from "@/lib/repository";
import type { MarketReportSnapshot } from "@/lib/export/types";
import PropertySearchClient from "./PropertySearchClient";
import ProjectSelector from "./ProjectSelector";

export const metadata: Metadata = {
  title: "Find Properties & Owners",
  description:
    "Find motivated property owners and suitable rental properties to lease.",
};

/**
 * Statuses at which property searching is permitted.
 * "researching_city" is explicitly excluded — research must be completed first.
 */
const SEARCH_ELIGIBLE_STATUSES = new Set([
  "city_approved",
  "finding_property",
  "contacting_owner",
  "application_in_progress",
  "property_approved",
  "preparing_property",
  // Later pipeline stages that may still need to find properties
  "seeking_referrals",
  "reviewing_resident",
  "placement_approved",
]);

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

/** Parse "Atlanta, GA" → { city: "Atlanta", state: "GA" } */
function parseCommunity(community: string): { city: string; state: string } {
  const parts = community.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1] };
  }
  return { city: community.trim(), state: "" };
}

export default async function HousingSearchPage({ searchParams }: PageProps) {
  const { organizationId, user } = await requireOrganization();
  const params = await searchParams;
  const rawProjectId = params.project;

  // ── Validate projectId ──────────────────────────────────────────────────
  let projectId: string | null = null;
  if (rawProjectId) {
    const valid = await projectBelongsToOrg(rawProjectId, organizationId);
    if (valid) projectId = rawProjectId;
  }

  // No valid projectId → show project selector
  if (!projectId) {
    const activeProjects = await listActiveProjects(organizationId);
    return <ProjectSelector projects={activeProjects ?? []} />;
  }

  // ── Research gate ────────────────────────────────────────────────────────
  // Fetch the project to check its current status.
  const project = await getProjectById(projectId, organizationId);

  if (project && !SEARCH_ELIGIBLE_STATUSES.has(project.currentStatus)) {
    // Project is at Researching City — block property search
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
            Find Properties &amp; Owners
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
            {project.name}
          </p>
        </div>

        <div
          className="rounded-xl px-6 py-8"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
          }}
          role="status"
        >
          <h2
            className="text-base font-semibold mb-2"
            style={{ color: "var(--color-primary)" }}
          >
            Market Research Required First
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--color-text)", opacity: 0.7 }}>
            This project is currently in the{" "}
            <strong>Research</strong> stage. The city and market must be
            approved before searching for properties. Complete your City Report
            and advance the project status to continue.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${projectId}/research`}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              View City Report
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/housing-search"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                backgroundColor: "#fff",
              }}
            >
              Select a different project
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Valid projectId, eligible status — load data ─────────────────────────
  const db = getDb();

  // Non-blocking: check if there's a completed City Report for this project
  let hasCompletedReport = false;
  if (db) {
    try {
      const report = await getLatestReport(db, organizationId, projectId);
      hasCompletedReport = report !== null;
    } catch {
      // non-blocking — ignore failures
    }
  }

  const [savedDraft, savedLeads, marketResearch] = await Promise.all([
    getPropertySearchDraft(organizationId, user.dbUserId, projectId),
    listProjectLeads(organizationId, projectId),
    getMarketResearch(projectId, organizationId),
  ]);

  // ── Build initial draft with smart prefill priority ──────────────────────
  // Priority: (1) existing draft, (2) City Report snapshot, (3) project.community, (4) legacy market research, (5) blank

  let initialDraft: PropertySearchDraftView;

  if (savedDraft) {
    // (1) Existing draft — restore exactly
    initialDraft = savedDraft;
  } else {
    // Start with blank
    let prefillCity = "";
    let prefillState = "";
    let prefillMaxRent = "";

    // (2) City Report snapshot geography + economics
    if (hasCompletedReport && db) {
      try {
        const report = await getLatestReport(db, organizationId, projectId);
        if (report?.reportJson) {
          const snapshot = JSON.parse(report.reportJson) as MarketReportSnapshot;
          if (snapshot.geography?.city) prefillCity = snapshot.geography.city;
          if (snapshot.geography?.stateAbbr) prefillState = snapshot.geography.stateAbbr;
          // Conservative economics propertyRentUsd (only when explicitly present)
          const conservative = snapshot.economicsScenarios?.find(
            (s) => s.label === "Conservative"
          );
          if (conservative?.propertyRentUsd != null) {
            prefillMaxRent = String(conservative.propertyRentUsd);
          }
        }
      } catch {
        // non-blocking
      }
    }

    // (3) project.community — only if City Report didn't prefill
    if (!prefillCity && project?.community) {
      const parsed = parseCommunity(project.community);
      prefillCity = parsed.city;
      prefillState = parsed.state;
    }

    // (4) Legacy market research — maxAcceptableLease as fallback rent
    if (!prefillMaxRent && marketResearch?.maxAcceptableLease) {
      prefillMaxRent = marketResearch.maxAcceptableLease;
    }

    initialDraft = {
      projectId,
      city: prefillCity,
      state: prefillState,
      zipCode: "",
      propertyType: "",
      minBedrooms: "",
      minBathrooms: "",
      maxRent: prefillMaxRent,
      maxDaysListed: "",
      listingStatus: "active",
      submitted: false,
      lastSearchAt: null,
      resultsSnapshot: null,
      resultsCount: 0,
      queryFingerprint: null,
      mapLatitude: null,
      mapLongitude: null,
      mapRadiusMi: null,
      mapMode: "list",
    };
  }

  return (
    <PropertySearchClient
      initialDraft={initialDraft}
      savedLeadCount={savedLeads?.length ?? 0}
      savedLeads={savedLeads ?? []}
      rentCastConfigured={isRentCastConfigured()}
      isDemoMode={isDemoAllowed()}
      projectId={projectId}
      hasCompletedReport={hasCompletedReport}
    />
  );
}
