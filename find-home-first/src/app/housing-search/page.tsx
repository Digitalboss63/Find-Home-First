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
  type MarketResearchView,
  type ProjectView,
} from "@/lib/repository";
import { getLatestReport } from "@/lib/repository-intelligence";
import { getDb } from "@/db/client";
import { isRentCastConfigured } from "@/lib/rentcast";
import type { PropertySearchDraftView } from "@/lib/repository";
import type { MarketReportSnapshot } from "@/lib/export/types";
import {
  type PropertyFitCriteria,
  type PropertyTypePreferences,
} from "@/lib/property-relevance";
import PropertySearchClient from "./PropertySearchClient";
import { PersistOpportunitySearchContext } from "./PersistOpportunitySearchContext";
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

// ─── Build fit criteria ───────────────────────────────────────────────────────

function buildFitCriteria(
  project: ProjectView | null,
  marketResearch: MarketResearchView | null,
  report: MarketReportSnapshot | null,
  draft: PropertySearchDraftView
): PropertyFitCriteria {
  const criteria: PropertyFitCriteria = {};

  // Geography: a successful map-area search takes precedence over city/state.
  // Stale map coordinates from an earlier search are ignored unless mapMode is
  // explicitly "map".
  if (
    draft.mapMode === "map" &&
    draft.mapLatitude != null &&
    draft.mapLongitude != null &&
    draft.mapRadiusMi != null
  ) {
    const latitude = Number(draft.mapLatitude);
    const longitude = Number(draft.mapLongitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      criteria.mapLatitude = latitude;
      criteria.mapLongitude = longitude;
      criteria.mapRadiusMi = draft.mapRadiusMi;
    }
  }

  // Always retain the project's documented city/state so switching from a map
  // search back to a criteria search can restore the proper geography locally.
  // These values never come from the user's RentCast query filters.
  if (report?.geography?.city) {
    criteria.city = report.geography.city;
  } else if (project?.community) {
    const parts = project.community.split(",").map((s) => s.trim());
    criteria.city = parts[0] || undefined;
    if (parts.length >= 2) criteria.state = parts[1] || undefined;
  }

  if (report?.geography?.stateAbbr && !criteria.state) {
    criteria.state = report.geography.stateAbbr;
  }

  // Property type preferences: from marketResearch.propertyTypePreferences
  if (marketResearch?.propertyTypePreferences) {
    criteria.propertyTypePreferences = marketResearch.propertyTypePreferences as PropertyTypePreferences;
  }

  // Minimum bedrooms: from marketResearch
  if (marketResearch?.minimumBedrooms) {
    const parsed = parseInt(marketResearch.minimumBedrooms, 10);
    if (!isNaN(parsed)) criteria.minimumBedrooms = parsed;
  }

  // Maximum monthly lease: maxAcceptableLease first, then Conservative scenario
  if (marketResearch?.maxAcceptableLease) {
    const parsed = parseFloat(marketResearch.maxAcceptableLease);
    if (!isNaN(parsed)) criteria.maximumMonthlyLease = parsed;
  } else if (report) {
    const conservative = report.economicsScenarios?.find((s) => s.label === "Conservative");
    if (conservative?.propertyRentUsd != null) {
      criteria.maximumMonthlyLease = conservative.propertyRentUsd;
    }
  }

  // Required private room capacity
  if (marketResearch?.expectedPrivateRoomCapacity) {
    const parsed = parseInt(marketResearch.expectedPrivateRoomCapacity, 10);
    if (!isNaN(parsed)) criteria.requiredPrivateRoomCapacity = parsed;
  }

  // Baseline economics: from Conservative scenario (all 4 fields must be non-null)
  if (report) {
    const conservative = report.economicsScenarios?.find((s) => s.label === "Conservative");
    if (
      conservative &&
      conservative.netMarginUsd != null &&
      conservative.propertyRentUsd != null &&
      conservative.occupancyPct != null &&
      conservative.usableRooms != null
    ) {
      criteria.baselineEconomics = {
        baselineNetMargin: conservative.netMarginUsd,
        baselinePropertyRent: conservative.propertyRentUsd,
        baselineOccupancyPct: conservative.occupancyPct,
        baselineUsableRooms: conservative.usableRooms,
      };
    }
  }

  return criteria;
}

interface PageProps {
  searchParams: Promise<{ project?: string; zip?: string }>;
}

/** Parse "Atlanta, GA" → { city: "Atlanta", state: "GA" } */
function parseCommunity(community: string): { city: string; state: string } {
  const parts = community.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1] };
  }
  return { city: community.trim(), state: "" };
}

function sameLocationValue(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export default async function HousingSearchPage({ searchParams }: PageProps) {
  const { organizationId, user } = await requireOrganization();
  const params = await searchParams;
  const zipParam = (params.zip ?? "").trim();
  const rawZip = /^\d{5}$/.test(zipParam) ? zipParam : "";
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
  let parsedReport: MarketReportSnapshot | null = null;
  if (db) {
    try {
      const reportRow = await getLatestReport(db, organizationId, projectId);
      hasCompletedReport = reportRow !== null;
      if (reportRow?.reportJson) {
        parsedReport = JSON.parse(reportRow.reportJson) as MarketReportSnapshot;
      }
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
  // Current completed report/project geography is authoritative. Saved draft
  // filters may be restored only when they do not conflict with that geography.

  let initialDraft: PropertySearchDraftView;
  let shouldPersistCorrectedContext = false;

  let authoritativeCity = parsedReport?.geography?.city ?? "";
  let authoritativeState = parsedReport?.geography?.stateAbbr ?? "";

  if ((!authoritativeCity || !authoritativeState) && project?.community) {
    const parsed = parseCommunity(project.community);
    if (!authoritativeCity) authoritativeCity = parsed.city;
    if (!authoritativeState) authoritativeState = parsed.state;
  }

  if (savedDraft) {
    const savedGeographyIsStale =
      (!!authoritativeCity && !sameLocationValue(savedDraft.city, authoritativeCity)) ||
      (!!authoritativeState && !sameLocationValue(savedDraft.state, authoritativeState));

    const locationContextChanged = savedGeographyIsStale || !!rawZip;
    shouldPersistCorrectedContext = locationContextChanged;

    initialDraft = {
      ...savedDraft,
      city: authoritativeCity || savedDraft.city,
      state: authoritativeState || savedDraft.state,
      zipCode: rawZip || (savedGeographyIsStale ? "" : savedDraft.zipCode),
      ...(locationContextChanged
        ? {
            submitted: false,
            lastSearchAt: null,
            resultsSnapshot: null,
            resultsCount: 0,
            queryFingerprint: null,
            mapLatitude: null,
            mapLongitude: null,
            mapRadiusMi: null,
            mapMode: "list",
          }
        : {}),
    };
  } else {
    // Start with blank
    let prefillMaxRent = "";

    // City Report economics
    if (hasCompletedReport && parsedReport) {
      const conservative = parsedReport.economicsScenarios?.find(
        (s) => s.label === "Conservative"
      );
      if (conservative?.propertyRentUsd != null) {
        prefillMaxRent = String(conservative.propertyRentUsd);
      }
    }

    // Legacy market research — maxAcceptableLease as fallback rent
    if (!prefillMaxRent && marketResearch?.maxAcceptableLease) {
      prefillMaxRent = marketResearch.maxAcceptableLease;
    }

    initialDraft = {
      projectId,
      city: authoritativeCity,
      state: authoritativeState,
      zipCode: rawZip || "",
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
    shouldPersistCorrectedContext = !!rawZip;
  }

  // ── Build fit criteria ──────────────────────────────────────────────────
  const fitCriteria = buildFitCriteria(project, marketResearch, parsedReport, initialDraft);
  const initialPropertyTypePreferences: PropertyTypePreferences =
    (marketResearch?.propertyTypePreferences as PropertyTypePreferences) ?? {};

  return (
    <>
      {shouldPersistCorrectedContext && (
        <PersistOpportunitySearchContext draft={initialDraft} />
      )}
      <PropertySearchClient
        initialDraft={initialDraft}
        savedLeadCount={savedLeads?.length ?? 0}
        savedLeads={savedLeads ?? []}
        rentCastConfigured={isRentCastConfigured()}
        isDemoMode={isDemoAllowed()}
        projectId={projectId}
        hasCompletedReport={hasCompletedReport}
        fitCriteria={fitCriteria}
        initialPropertyTypePreferences={initialPropertyTypePreferences}
      />
    </>
  );
}
