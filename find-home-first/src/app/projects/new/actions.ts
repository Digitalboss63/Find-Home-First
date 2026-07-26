"use server";

import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { projects, projectStatusHistory } from "@/db/schema";

export interface CreateProjectState {
  error: string | null;
}

export async function createProjectAction(
  _prev: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const { organizationId } = await requireOrganization();

  // Extract and validate fields
  const name = ((formData.get("name") as string) ?? "").trim();
  const targetCity = ((formData.get("targetCity") as string) ?? "").trim();
  const state = ((formData.get("state") as string) ?? "").trim().toUpperCase();
  const radiusMilesRaw = formData.get("radiusMiles");
  const radiusMiles =
    radiusMilesRaw && String(radiusMilesRaw).trim() !== ""
      ? parseInt(String(radiusMilesRaw), 10)
      : null;
  const demographic = ((formData.get("demographic") as string) ?? "").trim();
  const privateSpaceStandard = (
    (formData.get("privateSpaceStandard") as string) ?? ""
  ).trim();
  const notes = ((formData.get("notes") as string) ?? "").trim();

  if (!name) {
    return { error: "Project name is required." };
  }
  if (!targetCity) {
    return { error: "Target city is required." };
  }
  if (!state || state.length !== 2) {
    return { error: "State must be a 2-letter abbreviation (e.g. GA)." };
  }

  const db = getDb();
  if (!db) {
    return { error: "Database unavailable. Please try again shortly." };
  }

  // Build community string
  const community = `${targetCity}, ${state}`;

  // Collect supplemental notes into blockerReason (available notes field)
  const notesParts = [
    demographic ? `Target demographic: ${demographic}` : null,
    privateSpaceStandard
      ? `Private-space standard: ${privateSpaceStandard}`
      : null,
    radiusMiles != null ? `Service radius: ${radiusMiles} miles` : null,
    notes || null,
  ].filter(Boolean);

  const nextAction = `Research ${community} housing market and identify target neighborhoods`;
  const blockerReason = notesParts.length > 0 ? notesParts.join("\n") : null;

  // Wrap project creation and status-history insert in one transaction
  let newProjectId: string;

  try {
    const result = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          organizationId,
          name,
          community,
          currentStatus: "researching_city",
          nextAction,
          blocker: null,
          blockerReason,
        })
        .returning({ id: projects.id });

      await tx.insert(projectStatusHistory).values({
        projectId: project.id,
        previousStatus: null,
        newStatus: "researching_city",
        reason: "Project created",
      });

      return project;
    });

    newProjectId = result.id;
  } catch (err) {
    console.error("[createProjectAction] transaction failed:", err);
    return { error: "Failed to create project. Please try again." };
  }

  revalidatePath("/");
  revalidatePath("/projects");

  // redirect() must be called outside the try/catch so Next.js can handle it.
  redirect(`/projects/${newProjectId}`);
}
