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
  listPropertyLeads,
  listActiveProjects,
  projectBelongsToOrg,
  getProjectById,
  isDemoAllowed,
} from "@/lib/repository";
import { isRentCastConfigured } from "@/lib/rentcast";
import type { PropertySearchDraftView } from "@/lib/repository";
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
            approved before searching for properties. Complete your market
            research and advance the project status to continue.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              Complete Market Research
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

  // ── Valid projectId, eligible status — load draft and leads ──────────────
  const [savedDraft, savedLeads] = await Promise.all([
    getPropertySearchDraft(organizationId, user.dbUserId, projectId),
    listPropertyLeads(organizationId),
  ]);

  const initialDraft: PropertySearchDraftView = savedDraft ?? {
    projectId,
    city: "",
    state: "",
    zipCode: "",
    propertyType: "",
    minBedrooms: "",
    minBathrooms: "",
    maxRent: "",
    maxDaysListed: "",
    listingStatus: "active",
    submitted: false,
    lastSearchAt: null,
    resultsSnapshot: null,
    resultsCount: 0,
    queryFingerprint: null,
  };

  return (
    <PropertySearchClient
      initialDraft={initialDraft}
      savedLeadCount={savedLeads?.length ?? 0}
      rentCastConfigured={isRentCastConfigured()}
      isDemoMode={isDemoAllowed()}
    />
  );
}
