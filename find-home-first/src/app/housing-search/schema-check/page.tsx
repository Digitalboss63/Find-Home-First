import { sql } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertySearchDrafts } from "@/db/schema";

export default async function PropertyDraftSchemaCheckPage() {
  await requireOrganization();
  const db = getDb();

  let modernRead = "Database unavailable";
  let columns: string[] = [];
  let indexes: string[] = [];

  if (db) {
    try {
      await db
        .select({
          mapLatitude: propertySearchDrafts.mapLatitude,
          mapLongitude: propertySearchDrafts.mapLongitude,
          mapRadiusMi: propertySearchDrafts.mapRadiusMi,
          mapMode: propertySearchDrafts.mapMode,
        })
        .from(propertySearchDrafts)
        .limit(1);
      modernRead = "OK — map-state columns are readable";
    } catch (error) {
      modernRead = `ERROR — ${error instanceof Error ? error.message : String(error)}`;
    }

    try {
      const result = await db.execute(sql`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'property_search_drafts'
        ORDER BY ordinal_position
      `);
      columns = Array.from(result as Iterable<{ column_name: string }>).map(
        (row) => row.column_name
      );
    } catch (error) {
      columns = [`ERROR — ${error instanceof Error ? error.message : String(error)}`];
    }

    try {
      const result = await db.execute(sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'property_search_drafts'
        ORDER BY indexname
      `);
      indexes = Array.from(result as Iterable<{ indexdef: string }>).map(
        (row) => row.indexdef
      );
    } catch (error) {
      indexes = [`ERROR — ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold">Property Draft Schema Check</h1>
      <p className="mt-2 text-sm opacity-70">Read-only production database inspection.</p>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-bold">Modern draft read</h2>
        <p className="mt-2 break-words">{modernRead}</p>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-bold">Columns</h2>
        <pre className="mt-2 whitespace-pre-wrap text-sm">{columns.join("\n")}</pre>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="font-bold">Indexes</h2>
        <pre className="mt-2 whitespace-pre-wrap text-sm">{indexes.join("\n\n")}</pre>
      </section>
    </main>
  );
}
