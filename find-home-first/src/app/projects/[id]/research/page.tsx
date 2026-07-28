import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { getProjectById, getMarketResearch } from "@/lib/repository";
import ResearchWorkspace from "./ResearchWorkspace";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Market Research — Project ${id}` };
}

export const dynamic = "force-dynamic";

export default async function ResearchPage({ params }: Props) {
  const { id } = await params;
  const { organizationId } = await requireOrganization();

  const project = await getProjectById(id, organizationId);
  if (!project) notFound();

  const research = await getMarketResearch(id, organizationId);

  return (
    <div style={{ maxWidth: "56rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href={`/projects/${id}`}
          style={{ fontSize: "0.875rem", color: "var(--color-action)", textDecoration: "none" }}
        >
          ← Back to Project
        </Link>
      </div>
      <ResearchWorkspace project={project} research={research} />
    </div>
  );
}
