import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertySearchDrafts } from "@/db/schema";

/**
 * Resume the user's most recently saved property search.
 *
 * The property-search draft is the source of truth for return navigation.
 * Ranked-ZIP handoffs and manual field edits both update `updatedAt`, so the
 * newest draft represents the search the user most recently chose to work on.
 */
export default async function ResumePropertySearchPage() {
  const { organizationId, user } = await requireOrganization();
  const db = getDb();

  let projectId: string | null = null;

  if (db) {
    try {
      const rows = await db
        .select({ projectId: propertySearchDrafts.projectId })
        .from(propertySearchDrafts)
        .where(
          and(
            eq(propertySearchDrafts.organizationId, organizationId),
            eq(propertySearchDrafts.userId, user.dbUserId)
          )
        )
        .orderBy(desc(propertySearchDrafts.updatedAt))
        .limit(1);

      projectId = rows[0]?.projectId ?? null;
    } catch {
      console.warn("[housing-search] resume latest draft failed");
    }
  }

  if (projectId) {
    redirect(`/housing-search?project=${encodeURIComponent(projectId)}`);
  }

  // No saved draft yet: fall back to the normal project selector.
  redirect("/housing-search");
}
