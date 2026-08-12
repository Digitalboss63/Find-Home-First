"use server";

import { and, eq, inArray, like, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import {
  contacts,
  projectStatusHistory,
  projects,
  properties,
  residents,
  tasks,
} from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import {
  isIsoDate,
  residentPropertyFit,
  todayIso,
} from "@/lib/placement-workflow";
import { PREPARATION_TASKS, createPreparationTasks } from "@/lib/repository-leads";

export type PlacementActionResult =
  | { ok: true; message: string; residentId?: string }
  | { ok: false; error: string };

function clean(value: unknown, max = 1000): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}

async function authorizedProject(projectId: string) {
  const { organizationId } = await requireOrganization();
  const db = getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      currentStatus: projects.currentStatus,
      propertyId: projects.propertyId,
      residentId: projects.residentId,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!rows[0]) throw new Error("Project not found");
  return { db, organizationId, project: rows[0] };
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/placement`);
  revalidatePath("/people");
  revalidatePath("/");
}

export async function ensurePreparationChecklistAction(
  projectId: string,
): Promise<PlacementActionResult> {
  try {
    const { db, organizationId, project } = await authorizedProject(projectId);
    if (project.currentStatus !== "preparing_property" || !project.propertyId) {
      return { ok: false, error: "Secure a property before creating its preparation checklist." };
    }
    const propertyRows = await db
      .select({ leadId: properties.leadId })
      .from(properties)
      .where(
        and(
          eq(properties.id, project.propertyId),
          eq(properties.organizationId, organizationId),
        ),
      )
      .limit(1);
    const leadId = propertyRows[0]?.leadId;
    if (!leadId) return { ok: false, error: "The secured property is missing its source lead." };
    const created = await createPreparationTasks(db, organizationId, projectId, leadId);
    refresh(projectId);
    return {
      ok: true,
      message: created > 0 ? "Preparation checklist created." : "Preparation checklist is ready.",
    };
  } catch {
    return { ok: false, error: "The preparation checklist could not be created." };
  }
}

export async function updatePreparationTaskAction(
  projectId: string,
  taskId: string,
  completed: boolean,
): Promise<PlacementActionResult> {
  try {
    const { db, organizationId, project } = await authorizedProject(projectId);
    if (project.currentStatus !== "preparing_property" || !project.propertyId) {
      return { ok: false, error: "This project is not in property preparation." };
    }
    const propertyRows = await db
      .select({ leadId: properties.leadId })
      .from(properties)
      .where(
        and(
          eq(properties.id, project.propertyId),
          eq(properties.organizationId, organizationId),
        ),
      )
      .limit(1);
    const leadId = propertyRows[0]?.leadId;
    if (!leadId) return { ok: false, error: "Secured property lead not found." };

    const changed = await db
      .update(tasks)
      .set({
        status: completed ? "completed" : "upcoming",
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.organizationId, organizationId),
          eq(tasks.projectId, projectId),
          eq(tasks.leadId, leadId),
          inArray(tasks.title, [...PREPARATION_TASKS]),
        ),
      )
      .returning({ id: tasks.id });
    if (changed.length !== 1) return { ok: false, error: "Preparation task not found." };
    refresh(projectId);
    return { ok: true, message: completed ? "Task completed." : "Task reopened." };
  } catch {
    return { ok: false, error: "The preparation task could not be updated." };
  }
}

export async function completePropertyPreparationAction(
  projectId: string,
): Promise<PlacementActionResult> {
  try {
    const { db, organizationId, project } = await authorizedProject(projectId);
    if (project.currentStatus !== "preparing_property" || !project.propertyId) {
      return { ok: false, error: "This project is not ready to complete property preparation." };
    }
    const propertyRows = await db
      .select({ id: properties.id, leadId: properties.leadId })
      .from(properties)
      .where(
        and(
          eq(properties.id, project.propertyId),
          eq(properties.organizationId, organizationId),
        ),
      )
      .limit(1);
    const property = propertyRows[0];
    if (!property?.leadId) return { ok: false, error: "Secured property not found." };
    const checklist = await db
      .select({ title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          eq(tasks.projectId, projectId),
          eq(tasks.leadId, property.leadId),
          inArray(tasks.title, [...PREPARATION_TASKS]),
        ),
      );
    const completed = new Set(
      checklist.filter((item) => item.status === "completed").map((item) => item.title),
    );
    const missing = PREPARATION_TASKS.filter((title) => !completed.has(title));
    if (missing.length > 0) {
      return { ok: false, error: `Complete all preparation tasks first (${missing.length} remaining).` };
    }

    const today = todayIso();
    await db.transaction(async (tx) => {
      await tx
        .update(properties)
        .set({ readinessStatus: "available", availableDate: today, updatedAt: new Date() })
        .where(
          and(
            eq(properties.id, property.id),
            eq(properties.organizationId, organizationId),
          ),
        );
      await tx
        .update(projects)
        .set({
          currentStatus: "seeking_referrals",
          nextAction: "Review referral sources and add prospective residents.",
          blocker: null,
          blockerReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
        );
      await tx.insert(projectStatusHistory).values({
        projectId,
        previousStatus: "preparing_property",
        newStatus: "seeking_referrals",
        reason: "Property preparation checklist completed; property marked ready.",
      });
    });
    refresh(projectId);
    return { ok: true, message: "Property is ready. Resident matching is now open." };
  } catch {
    return { ok: false, error: "Property preparation could not be completed." };
  }
}

export interface CreateResidentInput {
  projectId: string;
  displayName: string;
  referralContactId: string | null;
  householdSize: number;
  bedroomsNeeded: number;
  accessibilityNeeds: string | null;
  incomeRange: string | null;
  notes: string | null;
}

export async function createResidentCandidateAction(
  input: CreateResidentInput,
): Promise<PlacementActionResult> {
  const displayName = clean(input.displayName, 120);
  if (!displayName) return { ok: false, error: "Resident or household display name is required." };
  if (!Number.isInteger(input.householdSize) || input.householdSize < 1 || input.householdSize > 30) {
    return { ok: false, error: "Household size must be between 1 and 30." };
  }
  if (!Number.isInteger(input.bedroomsNeeded) || input.bedroomsNeeded < 0 || input.bedroomsNeeded > 20) {
    return { ok: false, error: "Bedrooms needed must be between 0 and 20." };
  }
  try {
    const { db, organizationId, project } = await authorizedProject(input.projectId);
    if (!['seeking_referrals', 'reviewing_resident'].includes(project.currentStatus)) {
      return { ok: false, error: "Finish property preparation before adding resident candidates." };
    }
    if (input.referralContactId) {
      const contact = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.id, input.referralContactId),
            eq(contacts.organizationId, organizationId),
            eq(contacts.contactType, "referral"),
          ),
        )
        .limit(1);
      if (!contact[0]) return { ok: false, error: "Referral contact not found." };
    }
    const inserted = await db
      .insert(residents)
      .values({
        organizationId,
        displayName,
        referralContactId: input.referralContactId || null,
        householdSize: input.householdSize,
        bedroomsNeeded: input.bedroomsNeeded,
        accessibilityNeeds: clean(input.accessibilityNeeds, 1000),
        incomeRange: clean(input.incomeRange, 240),
        notes: clean(input.notes, 2000),
        placementStatus: "active",
      })
      .returning({ id: residents.id });
    refresh(input.projectId);
    return { ok: true, message: "Prospective resident added.", residentId: inserted[0].id };
  } catch {
    return { ok: false, error: "The prospective resident could not be added." };
  }
}

export async function selectResidentCandidateAction(
  projectId: string,
  residentId: string,
): Promise<PlacementActionResult> {
  try {
    const { db, organizationId, project } = await authorizedProject(projectId);
    if (!['seeking_referrals', 'reviewing_resident'].includes(project.currentStatus)) {
      return { ok: false, error: "This project is not accepting resident matches." };
    }
    if (!project.propertyId) return { ok: false, error: "Secured property not found." };
    const [propertyRows, residentRows, otherMatches] = await Promise.all([
      db
        .select({ bedrooms: properties.bedrooms, readinessStatus: properties.readinessStatus })
        .from(properties)
        .where(
          and(
            eq(properties.id, project.propertyId),
            eq(properties.organizationId, organizationId),
          ),
        )
        .limit(1),
      db
        .select({
          id: residents.id,
          displayName: residents.displayName,
          bedroomsNeeded: residents.bedroomsNeeded,
          placementStatus: residents.placementStatus,
        })
        .from(residents)
        .where(
          and(eq(residents.id, residentId), eq(residents.organizationId, organizationId)),
        )
        .limit(1),
      db
        .select({ id: projects.id, currentStatus: projects.currentStatus })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, organizationId),
            eq(projects.residentId, residentId),
            ne(projects.id, projectId),
          ),
        ),
    ]);
    const property = propertyRows[0];
    const resident = residentRows[0];
    if (!property || property.readinessStatus !== "available") {
      return { ok: false, error: "Mark the secured property ready before matching a resident." };
    }
    if (!resident || !['pending', 'active'].includes(resident.placementStatus)) {
      return { ok: false, error: "Resident candidate is not available for placement." };
    }
    if (otherMatches.some((match) => match.currentStatus !== "closed_not_proceeding")) {
      return { ok: false, error: "This resident is already assigned to another project." };
    }
    const fit = residentPropertyFit({
      propertyBedrooms: property.bedrooms,
      bedroomsNeeded: resident.bedroomsNeeded,
    });
    if (!fit.compatible) return { ok: false, error: fit.reason };

    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          residentId,
          currentStatus: "reviewing_resident",
          nextAction: "Verify program eligibility, funding, consent, accessibility, and housing fit.",
          updatedAt: new Date(),
        })
        .where(
          and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)),
        );
      await tx
        .update(residents)
        .set({ placementStatus: "active", updatedAt: new Date() })
        .where(
          and(eq(residents.id, residentId), eq(residents.organizationId, organizationId)),
        );
      await tx.insert(projectStatusHistory).values({
        projectId,
        previousStatus: project.currentStatus,
        newStatus: "reviewing_resident",
        reason: `Resident match selected for review: ${resident.displayName}. ${fit.reason}`,
      });
    });
    refresh(projectId);
    return { ok: true, message: "Resident selected. Complete the match review next." };
  } catch {
    return { ok: false, error: "The resident could not be selected." };
  }
}

export interface ApproveMatchInput {
  projectId: string;
  eligibilityConfirmed: boolean;
  fundingConfirmed: boolean;
  consentConfirmed: boolean;
  accessibilityReviewed: boolean;
  propertyFitConfirmed: boolean;
  notes: string | null;
}

export async function approveResidentMatchAction(
  input: ApproveMatchInput,
): Promise<PlacementActionResult> {
  const checks = [
    input.eligibilityConfirmed,
    input.fundingConfirmed,
    input.consentConfirmed,
    input.accessibilityReviewed,
    input.propertyFitConfirmed,
  ];
  if (!checks.every(Boolean)) {
    return { ok: false, error: "Confirm every resident-match requirement before approval." };
  }
  try {
    const { db, organizationId, project } = await authorizedProject(input.projectId);
    if (project.currentStatus !== "reviewing_resident" || !project.residentId || !project.propertyId) {
      return { ok: false, error: "Select a resident and property before approving the match." };
    }
    const reason = ["Resident match approved after required review.", clean(input.notes, 1500)]
      .filter(Boolean)
      .join(" ");
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          currentStatus: "placement_approved",
          nextAction: "Choose and confirm the move-in date.",
          updatedAt: new Date(),
        })
        .where(
          and(eq(projects.id, input.projectId), eq(projects.organizationId, organizationId)),
        );
      await tx.insert(projectStatusHistory).values({
        projectId: input.projectId,
        previousStatus: "reviewing_resident",
        newStatus: "placement_approved",
        reason,
      });
    });
    refresh(input.projectId);
    return { ok: true, message: "Resident match approved. Schedule move-in next." };
  } catch {
    return { ok: false, error: "The resident match could not be approved." };
  }
}

export async function scheduleMoveInAction(
  projectId: string,
  moveInDate: string,
): Promise<PlacementActionResult> {
  if (!isIsoDate(moveInDate) || moveInDate < todayIso()) {
    return { ok: false, error: "Choose today or a future move-in date." };
  }
  try {
    const { db, organizationId, project } = await authorizedProject(projectId);
    if (!['placement_approved', 'move_in_scheduled'].includes(project.currentStatus)) {
      return { ok: false, error: "Approve the resident match before scheduling move-in." };
    }
    if (!project.residentId || !project.propertyId) {
      return { ok: false, error: "The placement is missing its resident or property." };
    }
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          targetMoveIn: moveInDate,
          currentStatus: "move_in_scheduled",
          nextAction: `Complete move-in and confirm occupancy on ${moveInDate}.`,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
      const existing = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            eq(tasks.projectId, projectId),
            like(tasks.title, "Complete move-in%"),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await tx
          .update(tasks)
          .set({ dueDate: moveInDate, status: "upcoming", completedAt: null, updatedAt: new Date() })
          .where(eq(tasks.id, existing[0].id));
      } else {
        await tx.insert(tasks).values({
          organizationId,
          projectId,
          title: `Complete move-in for ${project.name}`,
          description: "Confirm occupancy, keys, inspection, and move-in handoff.",
          dueDate: moveInDate,
          status: "upcoming",
        });
      }
      await tx.insert(projectStatusHistory).values({
        projectId,
        previousStatus: project.currentStatus,
        newStatus: "move_in_scheduled",
        reason: `Move-in scheduled for ${moveInDate}.`,
      });
    });
    refresh(projectId);
    return { ok: true, message: `Move-in scheduled for ${moveInDate}.` };
  } catch {
    return { ok: false, error: "Move-in could not be scheduled." };
  }
}

export interface ConfirmMoveInInput {
  projectId: string;
  actualMoveInDate: string;
  occupancyConfirmed: boolean;
  keysConfirmed: boolean;
  inspectionConfirmed: boolean;
  contactsConfirmed: boolean;
  notes: string | null;
}

export async function confirmMoveInAction(
  input: ConfirmMoveInInput,
): Promise<PlacementActionResult> {
  if (!isIsoDate(input.actualMoveInDate) || input.actualMoveInDate > todayIso()) {
    return { ok: false, error: "Actual move-in date must be today or earlier." };
  }
  if (![input.occupancyConfirmed, input.keysConfirmed, input.inspectionConfirmed, input.contactsConfirmed].every(Boolean)) {
    return { ok: false, error: "Confirm every move-in handoff item before completing the placement." };
  }
  try {
    const { db, organizationId, project } = await authorizedProject(input.projectId);
    if (project.currentStatus !== "move_in_scheduled" || !project.residentId || !project.propertyId) {
      return { ok: false, error: "A scheduled placement with a resident and property is required." };
    }
    const residentId = project.residentId;
    const propertyId = project.propertyId;
    const note = clean(input.notes, 1500);
    await db.transaction(async (tx) => {
      await tx
        .update(projects)
        .set({
          currentStatus: "moved_in",
          nextAction: null,
          blocker: null,
          blockerReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, organizationId)));
      await tx
        .update(residents)
        .set({ placementStatus: "placed", updatedAt: new Date() })
        .where(
          and(eq(residents.id, residentId), eq(residents.organizationId, organizationId)),
        );
      await tx
        .update(properties)
        .set({ readinessStatus: "occupied", updatedAt: new Date() })
        .where(
          and(eq(properties.id, propertyId), eq(properties.organizationId, organizationId)),
        );
      await tx
        .update(tasks)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            eq(tasks.projectId, input.projectId),
            like(tasks.title, "Complete move-in%"),
          ),
        );
      await tx.insert(projectStatusHistory).values({
        projectId: input.projectId,
        previousStatus: "move_in_scheduled",
        newStatus: "moved_in",
        reason: [
          `Move-in confirmed for ${input.actualMoveInDate}. Occupancy, keys, inspection, and contact handoff confirmed.`,
          note,
        ]
          .filter(Boolean)
          .join(" "),
      });
    });
    refresh(input.projectId);
    return { ok: true, message: "Move-in confirmed. Placement complete." };
  } catch {
    return { ok: false, error: "Move-in could not be confirmed." };
  }
}
