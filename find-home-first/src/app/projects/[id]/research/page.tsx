/**
 * /projects/[id]/research — City Demographic & Opportunity Report
 *
 * Primary research experience for a placement project.
 * Renders the automated City Report (generate, view, export, proceed).
 *
 * The manual ResearchWorkspace component is preserved as dormant legacy code
 * but is not rendered here. The approve/hold/reject server actions remain
 * intact and available for future use; they are not part of the active flow.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { getProjectById } from "@/lib/repository";
import { CityReportPage } from "./CityReportPage";
import { VeteranNeedTargeting } from "./VeteranNeedTargeting";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `City Report — Project ${id}` };
}

export const dynamic = "force-dynamic";

export default async function ResearchPage({ params }: Props) {
  const { id } = await params;
  const { organizationId } = await requireOrganization();

  const project = await getProjectById(id, organizationId);
  if (!project) notFound();

  return (
    <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <VeteranNeedTargeting projectId={id} />
      <CityReportPage
        projectId={id}
        projectName={project.name}
        community={project.community}
        currentStatus={project.currentStatus}
      />
    </div>
  );
}
