import { NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { searchHelpTopics } from "@/lib/help-knowledge";
import {
  buildGuideAiInput,
  buildWorkflowFallbackAnswer,
  extractOpenAiResponseText,
  GUIDE_AI_INSTRUCTIONS,
} from "@/lib/guide-ai";
import { buildGuideProjectContext } from "@/lib/project-guidance";
import {
  getMarketResearch,
  getProjectById,
  listActiveProjects,
  listPropertyLeads,
  listTasksForProject,
} from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GuideAnswerRequest {
  question?: unknown;
  projectId?: unknown;
}

async function loadProjectContext(
  organizationId: string,
  requestedProjectId: string | null
) {
  let project = requestedProjectId
    ? await getProjectById(requestedProjectId, organizationId)
    : null;

  if (requestedProjectId && !project) {
    return { context: null, errorStatus: 404 as const };
  }

  if (!project) {
    const activeProjects = await listActiveProjects(organizationId);
    if (activeProjects === null) {
      return { context: null, errorStatus: 503 as const };
    }
    project =
      activeProjects.find((candidate) => candidate.blocker) ??
      activeProjects[0] ??
      null;
  }

  if (!project) {
    return {
      context: buildGuideProjectContext({ project: null }),
      errorStatus: null,
    };
  }

  const [research, projectTasks, allPropertyLeads] = await Promise.all([
    getMarketResearch(project.id, organizationId),
    listTasksForProject(project.id, organizationId),
    listPropertyLeads(organizationId),
  ]);

  const projectProperties = (allPropertyLeads ?? []).filter(
    (property) => property.projectId === project!.id
  );

  return {
    context: buildGuideProjectContext({
      project,
      research,
      tasks: projectTasks ?? [],
      properties: projectProperties,
    }),
    errorStatus: null,
  };
}

export async function POST(request: NextRequest) {
  const { organizationId } = await requireOrganization();

  let body: GuideAnswerRequest;
  try {
    body = (await request.json()) as GuideAnswerRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 2 || question.length > 1000) {
    return NextResponse.json(
      { error: "Question must be between 2 and 1000 characters." },
      { status: 400 }
    );
  }

  const requestedProjectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : null;

  const { context, errorStatus } = await loadProjectContext(
    organizationId,
    requestedProjectId
  );

  if (!context) {
    const message =
      errorStatus === 404
        ? "Project not found or unavailable."
        : "Project guidance is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: errorStatus ?? 503 });
  }

  const topics = searchHelpTopics(question).slice(0, 3);
  const fallback = buildWorkflowFallbackAnswer(context, topics);
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({
      answer: fallback,
      source: "workflow",
      action: context.nextAction,
    });
  }

  const model = process.env.FHF_GUIDE_MODEL?.trim() || "gpt-5.6-luna";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: GUIDE_AI_INSTRUCTIONS,
        input: buildGuideAiInput(question, context, topics),
        max_output_tokens: 350,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("[fhf-guide-ai] provider request failed", response.status);
      return NextResponse.json({
        answer: fallback,
        source: "workflow",
        action: context.nextAction,
      });
    }

    const payload = (await response.json()) as unknown;
    const answer = extractOpenAiResponseText(payload);

    return NextResponse.json({
      answer: answer || fallback,
      source: answer ? "ai" : "workflow",
      action: context.nextAction,
    });
  } catch (error) {
    console.warn(
      "[fhf-guide-ai] provider unavailable",
      error instanceof Error ? error.name : "unknown"
    );
    return NextResponse.json({
      answer: fallback,
      source: "workflow",
      action: context.nextAction,
    });
  } finally {
    clearTimeout(timeout);
  }
}
