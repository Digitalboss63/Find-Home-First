import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { propertySearchDrafts } from "@/db/schema";
import type { PropertySearchDraftView } from "@/lib/repository";

/**
 * Persist one user's search draft for one project.
 *
 * Prefer UPDATE for the normal case (a draft already exists). This avoids
 * relying on INSERT ... ON CONFLICT for every save and gives us a concrete
 * row-count signal. INSERT is used only for the first save.
 */
export async function persistPropertySearchDraft(
  organizationId: string,
  userId: string,
  draft: PropertySearchDraftView
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  const values = {
    city: draft.city,
    state: draft.state,
    zipCode: draft.zipCode,
    propertyType: draft.propertyType,
    minBedrooms: draft.minBedrooms,
    minBathrooms: draft.minBathrooms,
    maxRent: draft.maxRent,
    maxDaysListed: draft.maxDaysListed,
    listingStatus: draft.listingStatus,
    submitted: draft.submitted,
    lastSearchAt: draft.lastSearchAt ?? null,
    resultsSnapshot: draft.resultsSnapshot ?? null,
    resultsCount: draft.resultsCount,
    queryFingerprint: draft.queryFingerprint ?? null,
    mapLatitude: draft.mapLatitude ?? null,
    mapLongitude: draft.mapLongitude ?? null,
    mapRadiusMi: draft.mapRadiusMi ?? null,
    mapMode: draft.mapMode ?? "list",
    updatedAt: new Date(),
  };

  try {
    const updated = await db
      .update(propertySearchDrafts)
      .set(values)
      .where(
        and(
          eq(propertySearchDrafts.organizationId, organizationId),
          eq(propertySearchDrafts.userId, userId),
          eq(propertySearchDrafts.projectId, draft.projectId)
        )
      )
      .returning({ id: propertySearchDrafts.id });

    if (updated.length > 0) return true;

    await db.insert(propertySearchDrafts).values({
      organizationId,
      userId,
      projectId: draft.projectId,
      ...values,
    });
    return true;
  } catch (error) {
    console.error("[property-draft-write] persistence failed", error);
    return false;
  }
}
