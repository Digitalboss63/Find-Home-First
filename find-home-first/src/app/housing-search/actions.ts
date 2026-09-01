/**
 * Server actions for housing search — property lead workflow.
 *
 * SECURITY:
 * - organizationId and userId ALWAYS from requireOrganization().
 * - projectId verified as belonging to organizationId before every mutation.
 * - Completed City Report required for search, owner fetch, and lead saves.
 * - RENTCAST_API_KEY never surfaces to client; errors return generic messages.
 * - No client-supplied org/user IDs accepted.
 */
"use server";

import { unstable_rethrow } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  upsertPropertySearchDraft,
  getPropertySearchDraft,
  deletePropertySearchDraft,
  savePropertyLead,
  projectBelongsToOrg,
  getProjectById,
  getPropertyOwnerByRentcastId,
  upsertPropertyOwner,
  updateLeadOwner,
  updateLeadStage,
  upsertMarketResearch,
} from "@/lib/repository";
import { validatePropertyTypePreferences } from "@/lib/property-relevance";
import {
  makeAreaSearchFingerprint,
  makePropertySearchFingerprint,
} from "@/lib/property-search-state";
import { propertyLeads } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getLatestReport } from "@/lib/repository-intelligence";
import {
  searchRentalListings,
  getOwnerByPropertyId,
  isRentCastConfigured,
  type RentCastSearchParams,
  type RentCastListing,
  type RentCastOwner,
} from "@/lib/rentcast";
import type { PropertySearchDraftView } from "@/lib/repository";

// --- Shared eligibility guard -------------------------------------------------
//
// Every mutating Properties Finder action must pass this guard.
// It is server-only and cannot be bypassed by a crafted client request.
//
// Checks (in order):
//   1. requireOrganization() — authenticated org from Clerk session
//   2. projectBelongsToOrg() — project is owned by that org
//   3. Eligible project status — not in researching_city
//   4. Completed City Report exists — market_research_reports row with status=complete
//
// Returns { organizationId, userId, projectId } on success.
// Throws a string error message on any failure — callers return it to the client.

const SEARCH_ELIGIBLE_STATUSES = new Set([
  "city_approved",
  "finding_property",
  "contacting_owner",
  "application_in_progress",
  "property_approved",
  "preparing_property",
  "seeking_referrals",
  "reviewing_resident",
  "placement_approved",
]);

interface EligibilityContext {
  organizationId: string;
  userId: string;
  projectId: string;
}

async function requireEligibleProject(
  projectId: string | null | undefined
): Promise<EligibilityContext> {
  const { organizationId, user } = await requireOrganization();

  if (!projectId || typeof projectId !== "string") {
    throw new Error("A project must be selected.");
  }

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) throw new Error("Project not found.");

  const project = await getProjectById(projectId, organizationId);
  if (!project) throw new Error("Project not found.");

  if (!SEARCH_ELIGIBLE_STATUSES.has(project.currentStatus)) {
    throw new Error(
      "Generate and approve the City Report before searching for properties."
    );
  }

  const db = getDb();
  if (!db) throw new Error("Database unavailable.");

  const report = await getLatestReport(db, organizationId, projectId);
  if (!report || report.status !== "complete") {
    throw new Error(
      "A completed City Report is required before searching for properties."
    );
  }

  return { organizationId, userId: user.dbUserId, projectId };
}

// --- Listing status normalization ---------------------------------------------
// RentCast accepts "Active" or "Inactive" (title case).
// Omitting status defaults to Active on RentCast's end — we always send it
// explicitly so behavior is never ambiguous.
// Unknown/blank values fall back to "Active".

function normalizeListingStatus(raw: string): string {
  const normalized = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";
  if (normalized === "Inactive") return "Inactive";
  return "Active"; // default — also covers blank, "active", anything else
}

// --- Project scope guard ------------------------------------------------------

async function resolveProjectScope(
  organizationId: string,
  projectId: string | null | undefined
): Promise<string> {
  if (!projectId) throw new Error("A project must be selected before searching");
  const ok = await projectBelongsToOrg(projectId, organizationId);
  if (!ok) throw new Error("Project not found in this organization");
  return projectId;
}

// --- Draft persistence --------------------------------------------------------
// Draft saves use the lightweight project-ownership check only.
// They do not require a completed report (the draft may predate it).

export async function saveDraftAction(
  draft: PropertySearchDraftView
): Promise<{ ok: boolean }> {
  const { organizationId, user } = await requireOrganization();
  const projectId = await resolveProjectScope(
    organizationId,
    draft.projectId
  );
  const ok = await upsertPropertySearchDraft(organizationId, user.dbUserId, {
    ...draft,
    projectId,
  });
  return { ok };
}

export async function clearDraftAction(
  projectId?: string | null
): Promise<{ ok: boolean }> {
  const { organizationId, user } = await requireOrganization();
  const resolvedProjectId = await resolveProjectScope(
    organizationId,
    projectId ?? null
  );
  const ok = await deletePropertySearchDraft(
    organizationId,
    user.dbUserId,
    resolvedProjectId
  );
  return { ok };
}

// --- RentCast search ----------------------------------------------------------

export interface SearchResult {
  listings: RentCastListing[];
  error?: string;
  unconfigured?: boolean;
  queryFingerprint?: string;
  searchedAt?: string;
}

/**
 * Executes a RentCast rental listing search.
 *
 * RentCast parameter mapping (explicit, tested individually):
 *   draft.city          ? city
 *   draft.state         ? state
 *   draft.zipCode       ? zipCode
 *   draft.propertyType  ? propertyType
 *   draft.minBedrooms    -> bedrooms=VALUE:*  (minimum, RentCast range notation)
 *   draft.minBathrooms   -> bathrooms=VALUE:* (minimum, RentCast range notation)
 *   draft.maxRent        -> price=*:VALUE     (maximum, NOT maxPrice parameter)
 *   draft.maxDaysListed  -> daysOld=*:VALUE   (maximum, RentCast range notation)
 *   draft.listingStatus  -> status            ("Active" | "Inactive"; blank -> "Active")
 *
 *
 * The completed-City-Report check is enforced before the search executes.
 * A manually constructed request without a completed report is denied.
 */
export async function searchPropertiesAction(
  draft: PropertySearchDraftView
): Promise<SearchResult> {
  // Enforces: auth + project ownership + eligible status + completed City Report
  let ctx: EligibilityContext;
  try {
    ctx = await requireEligibleProject(draft.projectId);
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : "Project not eligible.";
    return { listings: [], error: msg };
  }
  const { organizationId, userId, projectId } = ctx;

  // Rate limit: 5 searches per org per minute
  const rl = checkRateLimit(`search:${organizationId}`, 5);
  if (!rl.allowed) {
    return {
      listings: [],
      error: `Too many searches. Try again in ${rl.resetInSeconds} seconds.`,
    };
  }

  if (!isRentCastConfigured()) {
    return {
      listings: [],
      unconfigured: true,
      error: "Property search is not yet configured. Contact your platform administrator.",
    };
  }

// Field-by-field mapping using RentCast range notation.
  // Each field is independently testable via URL inspection.
  const params: RentCastSearchParams = {
    city:         draft.city         || undefined,
    state:        draft.state        || undefined,
    zipCode:      draft.zipCode      || undefined,
    propertyType: draft.propertyType || undefined,
    // minBedrooms -> bedrooms=VALUE:* (range: at least VALUE)
    minBedrooms:  draft.minBedrooms  ? parseInt(draft.minBedrooms,  10) : undefined,
    // minBathrooms -> bathrooms=VALUE:* (range: at least VALUE)
    minBathrooms: draft.minBathrooms ? parseFloat(draft.minBathrooms)   : undefined,
    // maxRent -> price=*:VALUE (range: at most VALUE) — NOT maxPrice
    maxRent:      draft.maxRent      ? parseInt(draft.maxRent,      10) : undefined,
    // maxDaysListed -> daysOld=*:VALUE (range: at most VALUE)
    maxDaysOld:   draft.maxDaysListed ? parseInt(draft.maxDaysListed, 10) : undefined,
    // status: "Active" | "Inactive" — always sent explicitly; blank -> "Active"
    status:       normalizeListingStatus(draft.listingStatus || ""),
    limit: 25,
  };

  const result = await searchRentalListings(params);

  // A failed paid request must never overwrite the last successful snapshot.
  if (result.error) {
    return { listings: [], error: "The property search could not be completed. Please try again." };
  }

  const fingerprint = makePropertySearchFingerprint(draft);
  // [] is a valid successful result and is intentionally persisted so an
  // unchanged zero-result query can be reused without another paid request.
  const snapshot = JSON.stringify(result.listings);
  const searchedAt = new Date();

  await upsertPropertySearchDraft(organizationId, userId, {
    ...draft,
    projectId,
    submitted: true,
    lastSearchAt: searchedAt,
    resultsSnapshot: snapshot,
    resultsCount: result.listings.length,
    queryFingerprint: fingerprint,
    mapMode: "list",
  });

  return {
    listings: result.listings,
    queryFingerprint: fingerprint,
    searchedAt: searchedAt.toISOString(),
  };
}

// --- Search This Area ---------------------------------------------------------

export interface SearchThisAreaResult {
  listings: RentCastListing[];
  error?: string;
  unconfigured?: boolean;
  queryFingerprint?: string;
  searchedAt?: string;
}

/**
 * Search RentCast using map center coordinates and radius.
 * Uses latitude/longitude/radius params instead of city/state/ZIP.
 * City, state, and ZIP are omitted to avoid conflicting location parameters.
 * All non-location filters (property type, beds, baths, rent, status) are preserved.
 * The existing eligibility guard (completed City Report) is enforced.
 */
export async function searchThisAreaAction(input: {
  projectId: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  propertyType?: string;
  minBedrooms?: string;
  minBathrooms?: string;
  maxRent?: string;
  maxDaysListed?: string;
  listingStatus?: string;
}): Promise<SearchThisAreaResult> {
  let ctx: EligibilityContext;
  try {
    ctx = await requireEligibleProject(input.projectId);
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : "Project not eligible.";
    return { listings: [], error: msg };
  }
  const { organizationId, userId, projectId } = ctx;

  const rl = checkRateLimit(`search:${organizationId}`, 5);
  if (!rl.allowed) {
    return { listings: [], error: `Too many searches. Try again in ${rl.resetInSeconds} seconds.` };
  }

  if (!isRentCastConfigured()) {
    return { listings: [], unconfigured: true, error: "Property search is not yet configured." };
  }

  // Validate radius to supported values only
  const supportedRadii = [5, 10, 25] as const;
  const radius = supportedRadii.includes(input.radiusMiles as 5 | 10 | 25)
    ? input.radiusMiles
    : 10;

  const params: RentCastSearchParams = {
    // Location: circular area — city/state/ZIP intentionally omitted
    latitude:    input.latitude,
    longitude:   input.longitude,
    radius:      radius,
    // Non-location filters preserved
    propertyType: input.propertyType || undefined,
    minBedrooms:  input.minBedrooms ? parseInt(input.minBedrooms, 10) : undefined,
    minBathrooms: input.minBathrooms ? parseFloat(input.minBathrooms) : undefined,
    maxRent:      input.maxRent ? parseInt(input.maxRent, 10) : undefined,
    maxDaysOld:   input.maxDaysListed ? parseInt(input.maxDaysListed, 10) : undefined,
    status:       normalizeListingStatus(input.listingStatus || ""),
    limit: 25,
  };

  const result = await searchRentalListings(params);
  if (result.error) {
    return { listings: [], error: "The area search could not be completed. Please try again." };
  }

  const existing = await getPropertySearchDraft(organizationId, userId, projectId);
  const fingerprint = makeAreaSearchFingerprint({
    ...input,
    radiusMiles: radius,
  });
  const searchedAt = new Date();

  await upsertPropertySearchDraft(organizationId, userId, {
    projectId,
    city: existing?.city ?? "",
    state: existing?.state ?? "",
    zipCode: existing?.zipCode ?? "",
    propertyType: input.propertyType ?? "",
    minBedrooms: input.minBedrooms ?? "",
    minBathrooms: input.minBathrooms ?? "",
    maxRent: input.maxRent ?? "",
    maxDaysListed: input.maxDaysListed ?? "",
    listingStatus: input.listingStatus ?? "active",
    submitted: true,
    lastSearchAt: searchedAt,
    resultsSnapshot: JSON.stringify(result.listings),
    resultsCount: result.listings.length,
    queryFingerprint: fingerprint,
    mapLatitude: String(input.latitude),
    mapLongitude: String(input.longitude),
    mapRadiusMi: radius,
    mapMode: "map",
  });

  return {
    listings: result.listings,
    queryFingerprint: fingerprint,
    searchedAt: searchedAt.toISOString(),
  };
}

// --- Owner enrichment ---------------------------------------------------------

export interface OwnerResult {
  owner: RentCastOwner | null;
  ownerId: string | null;
  error?: string;
  unconfigured?: boolean;
  fromCache?: boolean;
}

/**
 * Fetches owner details for a property.
 *
 * Requires a completed City Report for the project (server-side enforced).
 * Checks the property_owners cache first — no RentCast call if owner is cached.
 * Persists the owner to property_owners on first fetch.
 * Returns ownerId so callers can link it to a saved lead immediately.
 *
 * Flow A (owner first, lead later): saveLeadAction recovers the cached owner by
 *   RentCast property ID even if the client does not retain ownerId.
 * Flow B (lead first, owner later): caller calls linkOwnerToLeadAction with
 *   the persisted ownerId after fetching.
 */
export async function fetchOwnerAction(
  propertyId: string,
  projectId: string
): Promise<OwnerResult> {
  // Enforces: auth + project ownership + eligible status + completed City Report
  let ctx: EligibilityContext;
  try {
    ctx = await requireEligibleProject(projectId);
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : "Project not eligible.";
    return { owner: null, ownerId: null, error: msg };
  }
  const { organizationId } = ctx;

  if (!propertyId || typeof propertyId !== "string") {
    return { owner: null, ownerId: null, error: "Invalid property ID" };
  }

  // Rate limit: 10 owner lookups per org per minute
  const rl = checkRateLimit(`owner:${organizationId}`, 10);
  if (!rl.allowed) {
    return { owner: null, ownerId: null, error: `Too many requests. Try again in ${rl.resetInSeconds} seconds.` };
  }

  // Check owner cache first — no RentCast API call if already stored
  const cached = await getPropertyOwnerByRentcastId(organizationId, propertyId);
  if (cached) {
    const ownerObj: RentCastOwner = {
      id: propertyId,
      formattedAddress: "",
      ownerName: cached.name,
      ownerType: cached.ownerType,
      mailingAddress: cached.mailingAddress,
      ownerOccupied: cached.ownerOccupied,
      mailingDiffersFromProperty: cached.mailingDiffersFromProperty ?? false,
    };
    return { owner: ownerObj, ownerId: cached.id, fromCache: true };
  }

  if (!isRentCastConfigured()) {
    return { owner: null, ownerId: null, unconfigured: true };
  }

  const result = await getOwnerByPropertyId(propertyId);
  if (result.error) {
    return { owner: null, ownerId: null, error: "Owner information could not be retrieved." };
  }

  // Persist owner to property_owners cache
  let ownerId: string | null = null;
  if (result.owner) {
    ownerId = await upsertPropertyOwner(organizationId, {
      rentcastPropertyId: propertyId,
      name: result.owner.ownerName ?? "Unknown Owner",
      ownerType: result.owner.ownerType ?? "unknown",
      mailingAddress: result.owner.mailingAddress,
      mailingDiffersFromProperty: result.owner.mailingDiffersFromProperty,
      ownerOccupied: result.owner.ownerOccupied,
      leadSource: "rentcast",
    });
  }

  return { owner: result.owner, ownerId };
}

// --- Save property lead -------------------------------------------------------

export interface SaveLeadResult {
  ok: boolean;
  leadId?: string;
  duplicate?: boolean;
  error?: string;
}

/**
 * Saves a property lead to property_leads.
 *
 * Requires a completed City Report for the project (server-side enforced).
 * Deduplication is project-scoped: the same property may be saved in two
 * different projects by the same organization.
 *
 * Supports both orderings:
 *   A (owner first): recover the cached owner from externalId and link on save.
 *   B (lead first):  call linkOwnerToLeadAction afterward.
 */
export async function saveLeadAction(input: {
  projectId: string;
  source: string;
  externalId?: string;
  sourceUrl?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent?: number;
  listingStatus?: string;
  listingDate?: string;
  lastSeenDate?: string;
  daysOnMarket?: number;
  listingContact?: string;
  listingPhone?: string;
  listingEmail?: string;
  opportunityScore?: number;
  opportunitySignals?: string;
  /** Optional explicit ownerId returned from fetchOwnerAction. */
  ownerId?: string;
  notes?: string;
}): Promise<SaveLeadResult> {
  // Enforces: auth + project ownership + eligible status + completed City Report
  let ctx: EligibilityContext;
  try {
    ctx = await requireEligibleProject(input.projectId);
  } catch (err) {
    unstable_rethrow(err);
    const msg = err instanceof Error ? err.message : "Project not eligible.";
    return { ok: false, error: msg };
  }
  const { organizationId } = ctx;

  if (!input.address || typeof input.address !== "string") {
    return { ok: false, error: "Address is required" };
  }

  // Owner-first flow must not depend on transient browser state. Owner lookups are
  // cached by RentCast property ID, so recover that cached owner when the listing
  // is saved even if the client did not retain ownerId from fetchOwnerAction.
  let verifiedOwnerId = input.ownerId || undefined;
  if (!verifiedOwnerId && input.source === "rentcast" && input.externalId) {
    const cachedOwner = await getPropertyOwnerByRentcastId(
      organizationId,
      input.externalId
    );
    verifiedOwnerId = cachedOwner?.id;
  }

  const result = await savePropertyLead(organizationId, {
    ...input,
    projectId: ctx.projectId,
  });
  if (!result) {
    return { ok: false, error: "Could not save property lead." };
  }

  // Link whenever an owner is known. This also repairs an existing duplicate lead
  // that was saved before its cached owner was connected.
  if (verifiedOwnerId) {
    const linked = await updateLeadOwner(organizationId, result.id, verifiedOwnerId);
    if (!linked) {
      console.warn("[housing-search] saved lead but owner link failed", {
        leadId: result.id,
        ownerId: verifiedOwnerId,
      });
    }
  }

  return { ok: true, leadId: result.id, duplicate: result.duplicate };
}

// --- Link owner to lead -------------------------------------------------------

export interface LinkOwnerResult {
  ok: boolean;
  error?: string;
}

/**
 * Links a persisted owner to a saved lead (sequence B: lead saved first).
 * Both leadId and ownerId are verified against the authenticated organization.
 * projectId is required to confirm the lead belongs to the correct project —
 * a lead from a different project (even in the same org) is rejected.
 */
export async function linkOwnerToLeadAction(
  leadId: string,
  ownerId: string,
  projectId: string
): Promise<LinkOwnerResult> {
  const { organizationId } = await requireOrganization();

  // Verify project belongs to org
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  // updateLeadOwner verifies organizationId on both lead and owner
  // The lead must also belong to the specified project (cross-project protection)
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  // Verify the lead belongs to this org AND project before linking
  const leadRows = await db
    .select({ id: propertyLeads.id })
    .from(propertyLeads)
    .where(
      and(
        eq(propertyLeads.id, leadId),
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      )
    )
    .limit(1);

  if (leadRows.length === 0) {
    return { ok: false, error: "Lead not found in this project." };
  }

  const ok = await updateLeadOwner(organizationId, leadId, ownerId);
  if (!ok) return { ok: false, error: "Could not link owner to lead." };
  return { ok: true };
}

// --- Update lead stage --------------------------------------------------------

export interface UpdateLeadStageResult {
  ok: boolean;
  error?: string;
}

/**
 * Advances the acquisition stage on a project-scoped lead.
 * Constrained by organizationId + projectId + leadId.
 * Rejects a lead belonging to a different project even within the same org.
 */
export async function updateLeadStageAction(
  leadId: string,
  projectId: string,
  stage: string
): Promise<UpdateLeadStageResult> {
  const { organizationId } = await requireOrganization();

  // Verify project belongs to org
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  // Verify the lead belongs to this org AND project (cross-project protection)
  const leadRows = await db
    .select({ id: propertyLeads.id })
    .from(propertyLeads)
    .where(
      and(
        eq(propertyLeads.id, leadId),
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      )
    )
    .limit(1);

  if (leadRows.length === 0) {
    return { ok: false, error: "Lead not found in this project." };
  }

  const ok = await updateLeadStage(organizationId, leadId, stage);
  if (!ok) return { ok: false, error: "Could not update lead stage." };
  return { ok: true };
}

// --- Property type preferences ------------------------------------------------

/**
 * Saves property type preferences for a project's market research record.
 * Only updates propertyTypePreferences — never touches other fields.
 */
export async function savePropertyTypePreferencesAction(
  projectId: string,
  rawPreferences: unknown,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { organizationId } = await requireOrganization();

    if (!projectId || typeof projectId !== "string") {
      return { ok: false, error: "A project must be selected." };
    }

    const belongs = await projectBelongsToOrg(projectId, organizationId);
    if (!belongs) return { ok: false, error: "Project not found." };

    const validated = validatePropertyTypePreferences(rawPreferences);
    if (!validated.valid) {
      return { ok: false, error: validated.error };
    }

    const saved = await upsertMarketResearch(projectId, organizationId, {
      propertyTypePreferences: validated.data,
    });
    if (!saved) return { ok: false, error: "Could not save preferences." };

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save preferences." };
  }
}