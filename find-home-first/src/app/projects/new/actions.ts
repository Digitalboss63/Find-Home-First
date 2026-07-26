"use server";

import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { projects, projectStatusHistory } from "@/db/schema";

export async function createProjectAction(formData: FormData) {
  const { organizationId } = await requireOrganization();

  // Extract and validate fields
  const name = ((formData.get("name") as string) ?? "").trim();
  const targetCity = ((formData.get("targetCity") as string) ?? "").trim();
  const state = ((formData.get("state") as string) ?? "").trim().toUpperCase();
  const radiusMiles = formData.get("radiusMiles")
    ? parseInt(formData.get("radiusMiles") as string, 10)
    : null;
  const demographic = ((formData.get("demographic") as string) ?? "").trim();
  const privateSpaceStandard = (
    (formData.get("privateSpaceStandard") as string) ?? ""
  ).trim();
  const notes = ((formData.get("notes") as string) ?? "").trim();

  if (!name || !targetCity || !state) {
    throw new Error("Name, city, and state are required");
  }

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  // Build community string
  const community = [targetCity, state].filter(Boolean).join(", ");

  // Build notes (stored in blockerReason if no notes column — but schema has nextAction)
  // Schema has: name, community, currentStatus, nextAction, blocker, blockerReason
  const notesParts = [
    demographic ? `Target demographic: ${demographic}` : null,
    privateSpaceStandard
      ? `Private-space standard: ${privateSpaceStandard}`
      : null,
    radiusMiles ? `Service radius: ${radiusMiles} miles` : null,
    notes || null,
  ].filter(Boolean);

  const nextAction = `Research ${community} housing market and identify target neighborhoods`;
  // Store extra notes in blockerReason (descriptive notes field available)
  const blockerReason = notesParts.length > 0 ? notesParts.join("\n") : null;

  const [project] = await db
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

  await db.insert(projectStatusHistory).values({
    projectId: project.id,
    previousStatus: null,
    newStatus: "researching_city",
    reason: "Project created",
  });

  redirect(`/projects/${project.id}`);
}
