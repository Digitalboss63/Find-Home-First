import { NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import {
  getMarketResearch,
  getProjectById,
  listActiveProjects,
  listPropertyLeads,
  listTasksForProject,
} from "@/lib/repository";
import { buildGuideProjectContext } from "@/lib/project-guidance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { organizationId } = await requireOrganization();
  const requestedProjectId = request.nextUrl.searchParams.get("project")?.trim() || null;

  let project = requestedProjectId
    ? await getProjectById(requestedProjectId, organizationId)
    : null;

  if (requestedProjectId && !project) {
    return NextResponse.json(
      { error: "Project not found or unavailable." },
      { status: 404 }
    );
  }

  if (!project) {
    const activeProjects = await listActiveProjects(organizationId);
    if (activeProjects === null) {
      return NextResponse.json(
        { error: "Project guidance is temporarily unavailable." },
        { status: 503 }
      );
    }
    project = activeProjects.find((candidate) => candidate.blocker) ?? activeProjects[0] ?? null;
  }

  if (!project) {
    return NextResponse.json(buildGuideProjectContext({ project: null }));
  }

  const [research, projectTasks, allPropertyLeads] = await Promise.all([
    getMarketResearch(project.id, organizationId),
    listTasksForProject(project.id, organizationId),
    listPropertyLeads(organizationId),
  ]);

  const projectProperties = (allPropertyLeads ?? []).filter(
    (property) => property.projectId === project!.id
  );

  return NextResponse.json(
    buildGuideProjectContext({
      project,
      research,
      tasks: projectTasks ?? [],
      properties: projectProperties,
    })
  );
}
