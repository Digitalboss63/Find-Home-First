import { and, eq } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertySearchDrafts } from "@/db/schema";
import { projectBelongsToOrg } from "@/lib/repository";

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function PropertyDraftWriteCheckPage({ searchParams }: PageProps) {
  const { organizationId, user } = await requireOrganization();
  const params = await searchParams;
  const projectId = (params.project ?? "").trim();

  let result = "Not run";

  if (!projectId || !(await projectBelongsToOrg(projectId, organizationId))) {
    result = "ERROR — invalid project";
  } else {
    const db = getDb();
    if (!db) {
      result = "ERROR — database unavailable";
    } else {
      try {
        const existing = await db
          .select()
          .from(propertySearchDrafts)
          .where(
            and(
              eq(propertySearchDrafts.organizationId, organizationId),
              eq(propertySearchDrafts.userId, user.dbUserId),
              eq(propertySearchDrafts.projectId, projectId)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          result = "ERROR — no existing draft row for this project/user";
        } else {
          const r = existing[0];
          const returned = await db
            .insert(propertySearchDrafts)
            .values({
              organizationId,
              userId: user.dbUserId,
              projectId,
              city: r.city,
              state: r.state,
              zipCode: r.zipCode,
              propertyType: r.propertyType,
              minBedrooms: r.minBedrooms,
              minBathrooms: r.minBathrooms,
              maxRent: r.maxRent,
              maxDaysListed: r.maxDaysListed,
              listingStatus: r.listingStatus,
              submitted: r.submitted,
              lastSearchAt: r.lastSearchAt,
              resultsSnapshot: r.resultsSnapshot,
              resultsCount: r.resultsCount,
              queryFingerprint: r.queryFingerprint,
              mapLatitude: r.mapLatitude,
              mapLongitude: r.mapLongitude,
              mapRadiusMi: r.mapRadiusMi,
              mapMode: r.mapMode ?? "list",
              updatedAt: r.updatedAt,
            })
            .onConflictDoUpdate({
              target: [
                propertySearchDrafts.organizationId,
                propertySearchDrafts.userId,
                propertySearchDrafts.projectId,
              ],
              set: {
                city: r.city,
                state: r.state,
                zipCode: r.zipCode,
                updatedAt: r.updatedAt,
              },
            })
            .returning({ id: propertySearchDrafts.id });

          result = returned.length > 0
            ? `OK — exact ON CONFLICT write succeeded for draft ${returned[0].id}`
            : "ERROR — write completed but returned no row";
        }
      } catch (error) {
        const details = error instanceof Error
          ? `${error.name}: ${error.message}${error.cause ? ` | cause: ${String(error.cause)}` : ""}`
          : String(error);
        result = `ERROR — ${details}`;
      }
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Property Draft Write Check</h1>
      <p className="mt-2 text-sm opacity-70">
        Executes the same ON CONFLICT pattern using the draft's existing values. Geography is not changed.
      </p>
      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-bold">Result</h2>
        <p className="mt-2 break-words whitespace-pre-wrap">{result}</p>
      </section>
    </main>
  );
}
