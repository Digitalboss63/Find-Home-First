/**
 * /projects/[id]/market-intelligence
 *
 * Authenticated Market Intelligence Report page.
 * Loads the latest saved report from PostgreSQL on every visit.
 * The client component handles Generate / Refresh / Export controls.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { getProjectById } from "@/lib/repository";
import { MarketIntelligencePage } from "./MarketIntelligencePage";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Market Intelligence — Project ${id}` };
}

export const dynamic = "force-dynamic";

export default async function MarketIntelligencePageRoute({ params }: Props) {
  const { id } = await params;
  const { organizationId } = await requireOrganization();

  const project = await getProjectById(id, organizationId);
  if (!project) notFound();

  return (
    <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <Link
          href={`/projects/${id}`}
          style={{ fontSize: "0.875rem", color: "var(--color-action)", textDecoration: "none" }}
        >
          ← Back to Project
        </Link>
      </div>
      <MarketIntelligencePage projectId={id} projectName={project.name} community={project.community} />
    </div>
  );
}
