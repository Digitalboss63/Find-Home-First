/**
 * /projects/[id] — Project workspace
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_PROJECTS, DEMO_TASKS } from "@/demo/data";
import { getProjectById, listTasksForProject, isDemoAllowed } from "@/lib/repository";
import { requireOrganization } from "@/lib/auth";
import { STAGES } from "@/lib/stages";
import { canUseReferralFinder } from "@/lib/referral-partners";
import { canUsePlacementWorkspace, placementStageTitle } from "@/lib/placement-workflow";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const demo = DEMO_PROJECTS.find((p) => p.id === id);
  return { title: demo?.name ?? "Project" };
}

export const dynamic = "force-dynamic";

// ── Demo adapters ──────────────────────────────────────────────────────────────

function demoProjectView(id: string) {
  const p = DEMO_PROJECTS.find((p) => p.id === id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    community: p.community,
    currentStage: p.currentStage as string,
    currentStatus: "researching_city",
    targetMoveIn: p.targetMoveIn as string | null,
    blocker: p.blocker ?? null,
    blockerReason: null as string | null,
    nextAction: null as string | null,
    residentName: p.residentName as string | null,
    groupStatus: "active" as const,
  };
}

function demoTaskViews(projectId: string) {
  return DEMO_TASKS.filter((t) => t.projectId === projectId).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate as string | null,
    status: t.status,
  }));
}

// ── Stage Stepper ─────────────────────────────────────────────────────────────

function StageStepper({ currentStage }: { currentStage: string }) {
  const currentIdx =
    currentStage === "complete"
      ? STAGES.length
      : STAGES.findIndex((s) => s.key === currentStage);

  return (
    <ol
      aria-label="Placement journey stages"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {STAGES.map((stage, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li
            key={stage.key}
            aria-current={active ? "step" : undefined}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.875rem",
              padding: "0.75rem 0",
              borderBottom: i < STAGES.length - 1 ? "1px solid var(--color-border)" : undefined,
            }}
          >
            {/* Step indicator */}
            <div
              style={{
                width: "1.75rem",
                height: "1.75rem",
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 700,
                backgroundColor: done ? "#16a34a" : active ? "var(--color-action)" : "var(--color-surface-soft)",
                color: done || active ? "#fff" : "var(--color-text-muted)",
                opacity: 1,
              }}
            >
              {done ? "✓" : i + 1}
            </div>
            {/* Stage info */}
            <div>
              <p
                style={{
                  fontSize: "0.875rem",
                  fontWeight: active ? 700 : done ? 600 : 500,
                  margin: 0,
                  color: done ? "#166534" : active ? "var(--color-primary)" : "var(--color-text-muted)",
                }}
              >
                {stage.label}
                {active && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "var(--color-action)",
                      backgroundColor: "#EEF2FF",
                      padding: "0.1rem 0.4rem",
                      borderRadius: "9999px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Current
                  </span>
                )}
              </p>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: active || done ? "var(--color-text)" : "var(--color-text-muted)",
                  opacity: active || done ? 0.78 : 1,
                  margin: "0.2rem 0 0",
                }}
              >
                {stage.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const { organizationId } = await requireOrganization();

  const dbProject = await getProjectById(id, organizationId);
  const dbTasks = dbProject ? await listTasksForProject(id, organizationId) : null;

  const usingDemo = isDemoAllowed() && dbProject === null;
  if (!usingDemo && dbProject === null) notFound();

  const project = usingDemo
    ? demoProjectView(id)
    : {
        id: dbProject!.id,
        name: dbProject!.name,
        community: dbProject!.community,
        currentStage: dbProject!.currentStage,
        currentStatus: dbProject!.currentStatus,
        targetMoveIn: dbProject!.targetMoveIn,
        blocker: dbProject!.blocker,
        blockerReason: dbProject!.blockerReason,
        nextAction: dbProject!.nextAction,
        residentName: dbProject!.residentName,
        groupStatus: dbProject!.groupStatus,
      };

  if (!project) notFound();

  const allTasks = usingDemo
    ? demoTaskViews(id)
    : (dbTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        status: t.status,
      }));

  const openTasks = allTasks.filter((t) => t.status !== "completed");
  const completedTasks = allTasks.filter((t) => t.status === "completed");

  return (
    <div style={{ maxWidth: "48rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Back link */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/projects"
          style={{ fontSize: "0.875rem", color: "var(--color-action)", textDecoration: "none" }}
        >
          ← All Projects
        </Link>
      </div>

      {/* Project header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--color-primary)",
            margin: "0 0 0.25rem",
          }}
        >
          {project.name}
        </h1>
        <p style={{ fontSize: "0.9rem", color: "var(--color-text)", opacity: 0.6, margin: 0 }}>
          {project.community}
          {project.residentName ? ` · ${project.residentName}` : ""}
          {project.targetMoveIn ? ` · Target move-in: ${project.targetMoveIn}` : ""}
        </p>
      </div>

      {/* Blocker alert */}
      {project.blocker && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <p style={{ fontWeight: 600, color: "#991B1B", margin: "0 0 0.25rem", fontSize: "0.875rem" }}>
            Blocker: {project.blocker}
          </p>
          {project.blockerReason && (
            <p style={{ color: "#7F1D1D", fontSize: "0.825rem", margin: 0 }}>{project.blockerReason}</p>
          )}
        </div>
      )}

      {/* Next action */}
      {project.nextAction && (
        <div
          style={{
            backgroundColor: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: "0.75rem",
            padding: "0.875rem 1.25rem",
            marginBottom: "1.25rem",
          }}
        >
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1E40AF", margin: "0 0 0.2rem", opacity: 0.7 }}>
            NEXT ACTION
          </p>
          <p style={{ fontSize: "0.875rem", color: "#1E3A8A", margin: 0 }}>{project.nextAction}</p>
        </div>
      )}

      {/* Market Intelligence CTA — always shown */}
      <div
        style={{
          backgroundColor: "var(--color-surface-soft)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ fontWeight: 600, color: "var(--color-primary)", margin: "0 0 0.25rem", fontSize: "0.9rem" }}>
            City Demographic &amp; Opportunity Report
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--color-text)", opacity: 0.65, margin: 0 }}>
            City-level analysis of housing need, available programs, property economics, and recommended next steps.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
          <Link
            href={`/projects/${project.id}/research`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              backgroundColor: "var(--color-primary)",
              color: "#fff",
              textDecoration: "none",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            📊 View City Report →
          </Link>
        </div>
      </div>

      {canUseReferralFinder(project.currentStatus) && (
        <div
          style={{
            backgroundColor: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, color: "#166534", margin: "0 0 0.25rem", fontSize: "0.9rem" }}>
              Caseworker &amp; Referral Partner Finder
            </p>
            <p style={{ fontSize: "0.8rem", color: "#14532D", opacity: 0.8, margin: 0 }}>
              Build a source-backed list of caseworker and intake teams that can refer qualified residents when the property is ready.
            </p>
          </div>
          <Link
            href={`/projects/${project.id}/referrals`}
            style={{
              display: "inline-flex",
              backgroundColor: "#166534",
              color: "#fff",
              textDecoration: "none",
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 700,
            }}
          >
            Find Referral Sources →
          </Link>
        </div>
      )}

      {canUsePlacementWorkspace(project.currentStatus) && (
        <div
          style={{
            backgroundColor: "#EFF6FF",
            border: "1px solid #93C5FD",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, color: "#1E3A8A", margin: "0 0 0.25rem", fontSize: "0.9rem" }}>
              {placementStageTitle(project.currentStatus)}
            </p>
            <p style={{ fontSize: "0.8rem", color: "#1E40AF", opacity: 0.82, margin: 0 }}>
              Continue property preparation, resident matching, and move-in from one guided workspace.
            </p>
          </div>
          <Link
            href={`/projects/${project.id}/placement`}
            style={{
              display: "inline-flex",
              backgroundColor: "#1E3A8A",
              color: "#fff",
              textDecoration: "none",
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 700,
            }}
          >
            Open Placement Workspace →
          </Link>
        </div>
      )}

      {["contacting_owner", "application_in_progress", "property_approved"].includes(project.currentStatus) && (
        <div
          style={{
            backgroundColor: "#FFF7ED",
            border: "1px solid #FED7AA",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontWeight: 700, color: "#92400E", margin: "0 0 0.25rem", fontSize: "0.9rem" }}>
              Secure Property
            </p>
            <p style={{ fontSize: "0.8rem", color: "#9A3412", opacity: 0.85, margin: 0 }}>
              Continue owner outreach and negotiation, then record the signed agreement in the saved lead workspace.
            </p>
          </div>
          <Link
            href={`/housing-search?project=${project.id}`}
            style={{
              display: "inline-flex",
              backgroundColor: "var(--color-action)",
              color: "#fff",
              textDecoration: "none",
              padding: "0.625rem 1rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 700,
            }}
          >
            Continue Property Acquisition →
          </Link>
        </div>
      )}

      {/* Placement journey */}
      <section
        aria-labelledby="journey-heading"
        style={{
          backgroundColor: "#fff",
          border: "1px solid var(--color-border)",
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
        }}
      >
        <h2
          id="journey-heading"
          style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-primary)", margin: "0 0 1rem" }}
        >
          Placement Journey
        </h2>
        <StageStepper currentStage={project.currentStage} />
      </section>

      {/* Tasks */}
      <section
        aria-labelledby="tasks-heading"
        style={{
          backgroundColor: "#fff",
          border: "1px solid var(--color-border)",
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h2
            id="tasks-heading"
            style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-primary)", margin: 0 }}
          >
            Tasks
          </h2>
          <Link
            href="/tasks"
            style={{ fontSize: "0.8rem", color: "var(--color-action)", textDecoration: "none" }}
          >
            All tasks →
          </Link>
        </div>

        {openTasks.length === 0 && completedTasks.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "var(--color-text)", opacity: 0.5, margin: 0 }}>
            No tasks for this project.
          </p>
        ) : (
          <>
            {openTasks.length > 0 && (
              <div style={{ marginBottom: completedTasks.length > 0 ? "1rem" : 0 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text)", opacity: 0.5, margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Open ({openTasks.length})
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {openTasks.map((task) => (
                    <li
                      key={task.id}
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--color-text)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.5rem 0",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <span>{task.title}</span>
                      {task.dueDate && (
                        <span style={{ fontSize: "0.75rem", opacity: 0.55 }}>Due {task.dueDate}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {completedTasks.length > 0 && (
              <div>
                <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text)", opacity: 0.5, margin: "0 0 0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Completed ({completedTasks.length})
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {completedTasks.map((task) => (
                    <li
                      key={task.id}
                      style={{ fontSize: "0.875rem", color: "var(--color-text)", opacity: 0.5, textDecoration: "line-through" }}
                    >
                      {task.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
