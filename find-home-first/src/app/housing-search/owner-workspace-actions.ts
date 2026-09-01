"use server";

import { and, eq } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertyLeads, propertyOwners } from "@/db/schema";
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

interface WorkspaceOwnerResult {
  ok: boolean;
  owner: WorkspaceOwner | null;
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

export async function getLinkedOwnerForWorkspaceAction(
  leadId: string,
  projectId: string
): Promise<WorkspaceOwnerResult> {
  const { organizationId } = await requireOrganization();
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

  const lead = leadRows[0];
  if (!lead) return { ok: false, owner: null, error: "Lead not found in this project." };

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
    return { ok: true, owner: null, repaired };
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
    repaired,
    opportunityScore: enriched.score,
    opportunitySignals,
  };
}
