"use server";

import { and, eq } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertyLeads, propertyOwners, propertySearchDrafts } from "@/db/schema";
import { projectBelongsToOrg } from "@/lib/repository";
import { enrichScoreWithOwner } from "@/lib/opportunity-score";
import type { RentCastListing, RentCastOwner } from "@/lib/rentcast";

export interface WorkspaceOwner {
  id: string;
  name: string;
  ownerType: string;
  phone: string | null;
  email: string | null;
  mailingAddress: string | null;
  mailingDiffersFromProperty: boolean | null;
  ownerOccupied: boolean | null;
  leadSource: string;
  notes: string | null;
  preferredContactMethod: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  contactSource: string | null;
}

export interface WorkspaceLeadRefresh {
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  monthlyRent: string | null;
  listingStatus: string;
  listingDate: string | null;
  lastSeenDate: string | null;
  daysOnMarket: number | null;
  listingContact: string | null;
  listingPhone: string | null;
  listingEmail: string | null;
}

interface WorkspaceOwnerResult {
  ok: boolean;
  owner: WorkspaceOwner | null;
  leadRefresh?: WorkspaceLeadRefresh;
  repaired?: boolean;
  opportunityScore?: number | null;
  opportunitySignals?: string | null;
  error?: string;
}

function numericValue(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRentCastListing(value: unknown): value is RentCastListing {
  return !!value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string";
}

export async function getLinkedOwnerForWorkspaceAction(
  leadId: string,
  projectId: string
): Promise<WorkspaceOwnerResult> {
  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, owner: null, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, owner: null, error: "Project not found." };

  const leadRows = await db
    .select({
      ownerId: propertyLeads.ownerId,
      source: propertyLeads.source,
      externalId: propertyLeads.externalId,
      address: propertyLeads.address,
      city: propertyLeads.city,
      state: propertyLeads.state,
      zip: propertyLeads.zip,
      propertyType: propertyLeads.propertyType,
      bedrooms: propertyLeads.bedrooms,
      bathrooms: propertyLeads.bathrooms,
      monthlyRent: propertyLeads.monthlyRent,
      listingDate: propertyLeads.listingDate,
      daysOnMarket: propertyLeads.daysOnMarket,
      lastSeenDate: propertyLeads.lastSeenDate,
      listingStatus: propertyLeads.listingStatus,
      listingContact: propertyLeads.listingContact,
      listingPhone: propertyLeads.listingPhone,
      listingEmail: propertyLeads.listingEmail,
      occupancyStatus: propertyLeads.occupancyStatus,
    })
    .from(propertyLeads)
    .where(
      and(
        eq(propertyLeads.id, leadId),
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      )
    )
    .limit(1);

  let lead = leadRows[0];
  if (!lead) return { ok: false, owner: null, error: "Lead not found in this project." };

  // Self-heal provider-controlled listing metadata for older saved RentCast leads.
  // The latest successful search snapshot already contains the normalized RentCast
  // payload, so this repair does not spend another API call. User workflow fields
  // (stage, notes, owner link, outreach, negotiation) are never touched here.
  if (lead.source === "rentcast" && lead.externalId) {
    const draftRows = await db
      .select({ resultsSnapshot: propertySearchDrafts.resultsSnapshot })
      .from(propertySearchDrafts)
      .where(
        and(
          eq(propertySearchDrafts.organizationId, organizationId),
          eq(propertySearchDrafts.userId, user.dbUserId),
          eq(propertySearchDrafts.projectId, projectId)
        )
      )
      .limit(1);

    const snapshot = draftRows[0]?.resultsSnapshot;
    if (snapshot) {
      try {
        const parsed: unknown = JSON.parse(snapshot);
        const freshListing = Array.isArray(parsed)
          ? parsed.find((item): item is RentCastListing => isRentCastListing(item) && item.id === lead.externalId)
          : undefined;

        if (freshListing) {
          const refreshed: WorkspaceLeadRefresh = {
            propertyType: freshListing.propertyType ?? lead.propertyType,
            bedrooms: freshListing.bedrooms ?? lead.bedrooms,
            bathrooms: freshListing.bathrooms != null ? String(freshListing.bathrooms) : lead.bathrooms,
            monthlyRent: freshListing.price != null ? String(freshListing.price) : lead.monthlyRent,
            listingStatus: freshListing.status ?? lead.listingStatus,
            listingDate: freshListing.listingDate ?? lead.listingDate,
            lastSeenDate: freshListing.lastSeenDate ?? lead.lastSeenDate,
            daysOnMarket: freshListing.daysOnMarket ?? lead.daysOnMarket,
            listingContact: freshListing.listedBy ?? lead.listingContact,
            listingPhone: freshListing.listedByPhone ?? lead.listingPhone,
            listingEmail: freshListing.listedByEmail ?? lead.listingEmail,
          };

          await db
            .update(propertyLeads)
            .set({
              ...refreshed,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(propertyLeads.id, leadId),
                eq(propertyLeads.organizationId, organizationId),
                eq(propertyLeads.projectId, projectId)
              )
            );

          lead = { ...lead, ...refreshed };
        }
      } catch {
        // A malformed/missing snapshot is non-fatal; render the saved lead as-is.
      }
    }
  }

  const leadRefresh: WorkspaceLeadRefresh = {
    propertyType: lead.propertyType,
    bedrooms: lead.bedrooms,
    bathrooms: lead.bathrooms,
    monthlyRent: lead.monthlyRent,
    listingStatus: lead.listingStatus,
    listingDate: lead.listingDate,
    lastSeenDate: lead.lastSeenDate,
    daysOnMarket: lead.daysOnMarket,
    listingContact: lead.listingContact,
    listingPhone: lead.listingPhone,
    listingEmail: lead.listingEmail,
  };

  const ownerSelection = {
    id: propertyOwners.id,
    name: propertyOwners.name,
    ownerType: propertyOwners.ownerType,
    phone: propertyOwners.phone,
    email: propertyOwners.email,
    mailingAddress: propertyOwners.mailingAddress,
    mailingDiffersFromProperty: propertyOwners.mailingDiffersFromProperty,
    ownerOccupied: propertyOwners.ownerOccupied,
    leadSource: propertyOwners.leadSource,
    notes: propertyOwners.notes,
    preferredContactMethod: propertyOwners.preferredContactMethod,
    phoneVerifiedAt: propertyOwners.phoneVerifiedAt,
    emailVerifiedAt: propertyOwners.emailVerifiedAt,
    contactSource: propertyOwners.contactSource,
  };

  let ownerId = lead.ownerId;
  let owner: WorkspaceOwner | null = null;
  let repaired = false;

  // Self-heal older RentCast leads: owner lookup may already be cached even when
  // the lead was saved before owner-link persistence was fixed.
  if (!ownerId && lead.source === "rentcast" && lead.externalId) {
    const cachedRows = await db
      .select(ownerSelection)
      .from(propertyOwners)
      .where(
        and(
          eq(propertyOwners.organizationId, organizationId),
          eq(propertyOwners.rentcastPropertyId, lead.externalId)
        )
      )
      .limit(1);

    owner = cachedRows[0] ?? null;
    if (owner) {
      ownerId = owner.id;
      repaired = true;
    }
  }

  if (!owner && ownerId) {
    const ownerRows = await db
      .select(ownerSelection)
      .from(propertyOwners)
      .where(
        and(
          eq(propertyOwners.id, ownerId),
          eq(propertyOwners.organizationId, organizationId)
        )
      )
      .limit(1);
    owner = ownerRows[0] ?? null;
  }

  if (!owner || !ownerId) {
    return { ok: true, owner: null, leadRefresh, repaired };
  }

  // The listing card displays the owner-enriched score after owner lookup, but
  // older saved leads retained the pre-owner listing-only score. Recalculate
  // from the same deterministic score engine and persist the enriched result.
  const listing: RentCastListing = {
    id: lead.externalId ?? leadId,
    formattedAddress: lead.address,
    addressLine1: lead.address,
    city: lead.city ?? "",
    state: lead.state ?? "",
    zipCode: lead.zip ?? "",
    propertyType: lead.propertyType,
    bedrooms: lead.bedrooms,
    bathrooms: numericValue(lead.bathrooms),
    price: numericValue(lead.monthlyRent),
    listingType: null,
    listingDate: lead.listingDate,
    daysOnMarket: lead.daysOnMarket,
    lastSeenDate: lead.lastSeenDate,
    status: lead.listingStatus,
    listedBy: lead.listingContact,
    listedByPhone: lead.listingPhone,
    listedByEmail: lead.listingEmail,
    latitude: null,
    longitude: null,
  };

  const rentCastOwner: RentCastOwner = {
    id: owner.id,
    formattedAddress: lead.address,
    ownerName: owner.name,
    ownerType: owner.ownerType,
    mailingAddress: owner.mailingAddress,
    ownerOccupied: owner.ownerOccupied,
    mailingDiffersFromProperty: owner.mailingDiffersFromProperty ?? false,
  };

  const enriched = enrichScoreWithOwner(listing, rentCastOwner, lead.occupancyStatus);
  const opportunitySignals = JSON.stringify(enriched.signals);

  await db
    .update(propertyLeads)
    .set({
      ownerId,
      opportunityScore: enriched.score,
      opportunitySignals,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(propertyLeads.id, leadId),
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      )
    );

  return {
    ok: true,
    owner,
    leadRefresh,
    repaired,
    opportunityScore: enriched.score,
    opportunitySignals,
  };
}
