/**
 * Server actions for housing search — property lead workflow.
 *
 * SECURITY:
 * - organizationId and userId ALWAYS from requireOrganization().
 * - projectId (when supplied) verified as belonging to organizationId.
 * - RENTCAST_API_KEY never surfaces to client; errors return generic messages.
 * - No client-supplied org/user IDs accepted.
 */
"use server";

import { requireOrganization } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  upsertPropertySearchDraft,
  deletePropertySearchDraft,
  savePropertyLead,
  projectBelongsToOrg,
} from "@/lib/repository";
import {
  searchRentalListings,
  getOwnerByPropertyId,
  isRentCastConfigured,
  type RentCastSearchParams,
  type RentCastListing,
  type RentCastOwner,
} from "@/lib/rentcast";
import type { PropertySearchDraftView } from "@/lib/repository";

// ─── Query fingerprint ────────────────────────────────────────────────────────
// A deterministic string of the search parameters so we can detect staleness.

function makeFingerprint(draft: PropertySearchDraftView): string {
  return JSON.stringify({
    city: draft.city,
    state: draft.state,
    zipCode: draft.zipCode,
    propertyType: draft.propertyType,
    minBedrooms: draft.minBedrooms,
    minBathrooms: draft.minBathrooms,
    maxRent: draft.maxRent,
    maxDaysListed: draft.maxDaysListed,
    listingStatus: draft.listingStatus,
  });
}

// ─── Project scope guard ──────────────────────────────────────────────────────

async function resolveProjectScope(
  organizationId: string,
  projectId: string | null | undefined
): Promise<string> {
  if (!projectId) throw new Error("A project must be selected before searching");
  const ok = await projectBelongsToOrg(projectId, organizationId);
  if (!ok) throw new Error("Project not found in this organization");
  return projectId;
}

// ─── Draft persistence ────────────────────────────────────────────────────────

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

// ─── RentCast search ──────────────────────────────────────────────────────────

export interface SearchResult {
  listings: RentCastListing[];
  error?: string;
  unconfigured?: boolean;
}

/**
 * Executes a RentCast search.
 * Persists the result snapshot so returning users don't need a re-fetch.
 * Only called when the user presses "Search Properties".
 */
export async function searchPropertiesAction(
  draft: PropertySearchDraftView
): Promise<SearchResult> {
  const { organizationId, user } = await requireOrganization();

  // Rate limit: 5 searches per org per minute
  const rl = checkRateLimit(`search:${organizationId}`, 5);
  if (!rl.allowed) {
    return {
      listings: [],
      error: `Too many searches. Try again in ${rl.resetInSeconds} seconds.`,
    };
  }

  const projectId = await resolveProjectScope(
    organizationId,
    draft.projectId
  );

  if (!isRentCastConfigured()) {
    return {
      listings: [],
      unconfigured: true,
      error:
        "Property search is not yet configured. Contact your platform administrator.",
    };
  }

  const params: RentCastSearchParams = {
    city: draft.city || undefined,
    state: draft.state || undefined,
    zipCode: draft.zipCode || undefined,
    propertyType: draft.propertyType || undefined,
    bedrooms: draft.minBedrooms ? parseInt(draft.minBedrooms, 10) : undefined,
    bathrooms: draft.minBathrooms
      ? parseFloat(draft.minBathrooms)
      : undefined,
    maxPrice: draft.maxRent ? parseInt(draft.maxRent, 10) : undefined,
    daysOld: draft.maxDaysListed
      ? parseInt(draft.maxDaysListed, 10)
      : undefined,
    status: draft.listingStatus || "Active",
    limit: 25,
  };

  const result = await searchRentalListings(params);

  // Build snapshot regardless of error so we can clear it cleanly
  const fingerprint = makeFingerprint(draft);
  const snapshot = result.listings.length > 0
    ? JSON.stringify(result.listings)
    : null;

  // Persist submitted state + snapshot
  await upsertPropertySearchDraft(organizationId, user.dbUserId, {
    ...draft,
    projectId,
    submitted: true,
    lastSearchAt: new Date(),
    resultsSnapshot: snapshot,
    resultsCount: result.listings.length,
    queryFingerprint: fingerprint,
  });

  if (result.error) {
    return {
      listings: [],
      error: "The property search could not be completed. Please try again.",
    };
  }

  return { listings: result.listings };
}

// ─── Owner enrichment ─────────────────────────────────────────────────────────

export interface OwnerResult {
  owner: RentCastOwner | null;
  error?: string;
  unconfigured?: boolean;
}

export async function fetchOwnerAction(
  propertyId: string
): Promise<OwnerResult> {
  const { organizationId } = await requireOrganization();

  // Rate limit: 10 owner lookups per org per minute
  const rl = checkRateLimit(`owner:${organizationId}`, 10);
  if (!rl.allowed) {
    return { owner: null, error: `Too many requests. Try again in ${rl.resetInSeconds} seconds.` };
  }

  if (!isRentCastConfigured()) {
    return { owner: null, unconfigured: true };
  }

  if (!propertyId || typeof propertyId !== "string") {
    return { owner: null, error: "Invalid property ID" };
  }

  const result = await getOwnerByPropertyId(propertyId);
  if (result.error) {
    return { owner: null, error: "Owner information could not be retrieved." };
  }
  return { owner: result.owner };
}

// ─── Save property lead ───────────────────────────────────────────────────────

export interface SaveLeadResult {
  ok: boolean;
  leadId?: string;
  duplicate?: boolean;
  error?: string;
}

export async function saveLeadAction(input: {
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
  notes?: string;
}): Promise<SaveLeadResult> {
  const { organizationId } = await requireOrganization();

  if (!input.address || typeof input.address !== "string") {
    return { ok: false, error: "Address is required" };
  }

  const result = await savePropertyLead(organizationId, input);
  if (!result) {
    return { ok: false, error: "Could not save property lead." };
  }

  return { ok: true, leadId: result.id, duplicate: result.duplicate };
}
