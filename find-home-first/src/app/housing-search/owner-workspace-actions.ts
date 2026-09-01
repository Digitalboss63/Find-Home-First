"use server";

import { and, eq } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertyLeads, propertyOwners } from "@/db/schema";
import { projectBelongsToOrg } from "@/lib/repository";

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

export async function getLinkedOwnerForWorkspaceAction(
  leadId: string,
  projectId: string
): Promise<{ ok: boolean; owner: WorkspaceOwner | null; repaired?: boolean; error?: string }> {
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

    const cachedOwner = cachedRows[0];
    if (cachedOwner) {
      ownerId = cachedOwner.id;
      await db
        .update(propertyLeads)
        .set({ ownerId, updatedAt: new Date() })
        .where(
          and(
            eq(propertyLeads.id, leadId),
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.projectId, projectId)
          )
        );
      repaired = true;
      return { ok: true, owner: cachedOwner, repaired };
    }
  }

  if (!ownerId) return { ok: true, owner: null, repaired };

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

  return { ok: true, owner: ownerRows[0] ?? null, repaired };
}
