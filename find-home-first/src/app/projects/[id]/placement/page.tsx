import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireOrganization } from "@/lib/auth";
import { canUsePlacementWorkspace } from "@/lib/placement-workflow";
import { getPlacementWorkspace } from "@/lib/repository-placement";
import PlacementWorkspaceClient from "./PlacementWorkspaceClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Placement Workspace" };

export default async function PlacementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organizationId } = await requireOrganization();
  const db = getDb();
  if (!db) notFound();
  const data = await getPlacementWorkspace(db, organizationId, id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      <Link href={`/projects/${id}`} className="text-sm no-underline" style={{ color: "var(--color-action)" }}>
        ← Back to Project
      </Link>
      <header className="my-5">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          {data.project.community}
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          Placement Workspace
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Prepare the property, match a qualified resident, and confirm move-in for {data.project.name}.
        </p>
      </header>

      {canUsePlacementWorkspace(data.project.currentStatus) ? (
        <PlacementWorkspaceClient initialData={data} />
      ) : (
        <section className="rounded-xl p-5" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA" }}>
          <h2 className="font-bold" style={{ color: "#92400E" }}>Secure the property first</h2>
          <p className="mt-2 text-sm" style={{ color: "#9A3412" }}>
            The Placement Workspace opens after a property agreement is signed and the project enters property preparation.
          </p>
          <Link href={`/housing-search?project=${id}`} className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white no-underline" style={{ backgroundColor: "var(--color-action)" }}>
            Continue Property Acquisition →
          </Link>
        </section>
      )}
    </div>
  );
}
