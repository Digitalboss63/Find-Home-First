/**
 * Lead pipeline server actions — Owner Outreach → Secure Property workflow.
 *
 * SECURITY:
 * - organizationId is ALWAYS from requireOrganization() — never client input.
 * - Every action verifies project belongs to org and lead belongs to project+org.
 * - actorUserId resolved from clerkUserId → UUID via users table.
 * - Permitted stage transitions enforced server-side.
 * - Terminal stages require explicit reopenLeadAction with recorded reason.
 */
"use server";

import { eq, and } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertyLeads } from "@/db/schema";
import { isTransitionPermitted, TERMINAL_STAGES } from "@/lib/lead-pipeline";
import { projectBelongsToOrg } from "@/lib/repository";
import {
  resolveActorUserId,
  appendLeadActivity,
  updateLeadNegotiation,
  updateOwnerContact,
  transitionLeadStage,
  reopenLead,
  createLeadFollowUpTask,
  createOrUpdateSecuredProperty,
  createPreparationTasks,
  advanceProjectToPreparingProperty,
  checkExistingSecuredProperty,
  createOrUpdateShowingTask,
  resolveShowingTask,
  type NegotiationUpdate,
  type OwnerContactUpdate,
  type ShowingData,
} from "@/lib/repository-leads";

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface LeadRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  ownerId: string | null;
  acquisitionStage: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
}

async function loadAndVerifyLead(
  db: NonNullable<ReturnType<typeof getDb>>,
  leadId: string,
  organizationId: string,
  projectId: string
): Promise<LeadRecord | null> {
  const rows = await db
    .select({
      id: propertyLeads.id,
      organizationId: propertyLeads.organizationId,
      projectId: propertyLeads.projectId,
      ownerId: propertyLeads.ownerId,
      acquisitionStage: propertyLeads.acquisitionStage,
      address: propertyLeads.address,
      city: propertyLeads.city,
      state: propertyLeads.state,
      zip: propertyLeads.zip,
      propertyType: propertyLeads.propertyType,
      bedrooms: propertyLeads.bedrooms,
      bathrooms: propertyLeads.bathrooms,
    })
    .from(propertyLeads)
    .where(
      and(
        eq(propertyLeads.id, leadId),
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

// ─── recordOutreachAction ─────────────────────────────────────────────────────

export interface RecordOutreachInput {
  projectId: string;
  leadId: string;
  contactMethod: string;
  outcome: string;
  notes: string | null;
  nextFollowUpAt: string | null;
  advanceTo: string | null;
}

export async function recordOutreachAction(
  input: RecordOutreachInput
): Promise<{ ok: boolean; error?: string; followUpTaskId?: string }> {
  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(input.projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, input.leadId, organizationId, input.projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  if (input.advanceTo) {
    if (!isTransitionPermitted(lead.acquisitionStage, input.advanceTo)) {
      return {
        ok: false,
        error: `Stage transition from "${lead.acquisitionStage}" to "${input.advanceTo}" is not permitted.`,
      };
    }
  }

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  try {
    let followUpTaskId: string | undefined;
    await db.transaction(async (tx) => {
      const now = new Date();

      // 1. Append outreach activity
      await appendLeadActivity(tx, {
        organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        activityType: "outreach",
        contactMethod: input.contactMethod,
        outcome: input.outcome,
        notes: input.notes,
        stageBefore: lead.acquisitionStage,
        stageAfter: input.advanceTo ?? null,
        nextFollowUpAt: input.nextFollowUpAt,
        actorUserId,
      });

      // 2. Advance stage if requested (with stage_change activity)
      if (input.advanceTo) {
        await tx
          .update(propertyLeads)
          .set({ acquisitionStage: input.advanceTo, lastStageChangedAt: now, updatedAt: now })
          .where(and(eq(propertyLeads.id, input.leadId), eq(propertyLeads.organizationId, organizationId)));

        await appendLeadActivity(tx, {
          organizationId,
          projectId: input.projectId,
          leadId: input.leadId,
          ownerId: lead.ownerId,
          activityType: "stage_change",
          stageBefore: lead.acquisitionStage,
          stageAfter: input.advanceTo,
          notes: "Stage advanced during outreach recording.",
          actorUserId,
        });
      }

      // 3. Upsert follow-up task if date provided
      if (input.nextFollowUpAt) {
        const taskId = await createLeadFollowUpTask(
          tx,
          organizationId,
          input.projectId,
          input.leadId,
          input.nextFollowUpAt,
          lead.address
        );
        if (taskId) followUpTaskId = taskId;
      }

      // 4. Update owner preferred contact method (best-effort)
      if (lead.ownerId) {
        await updateOwnerContact(tx, lead.ownerId, organizationId, {
          preferredContactMethod: input.contactMethod,
        });
      }
    });

    return { ok: true, followUpTaskId };
  } catch (err) {
    console.error("[lead-actions] recordOutreachAction failed:", err);
    return { ok: false, error: "Could not record outreach. Please try again." };
  }
}

// ─── advanceLeadStageAction ───────────────────────────────────────────────────

export async function advanceLeadStageAction(
  leadId: string,
  projectId: string,
  toStage: string
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, leadId, organizationId, projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  try {
    let result: { ok: boolean; error?: string } = { ok: false };
    await db.transaction(async (tx) => {
      result = await transitionLeadStage(
        tx,
        leadId,
        organizationId,
        lead.acquisitionStage,
        toStage,
        actorUserId,
        { projectId, ownerId: lead.ownerId }
      );
    });
    return result;
  } catch (err) {
    console.error("[lead-actions] advanceLeadStageAction failed:", err);
    return { ok: false, error: "Could not advance stage. Please try again." };
  }
}

// ─── reopenLeadAction ─────────────────────────────────────────────────────────

export async function reopenLeadAction(
  leadId: string,
  projectId: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: "A reason is required to reopen a terminal lead." };
  }

  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, leadId, organizationId, projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  if (!TERMINAL_STAGES.has(lead.acquisitionStage)) {
    return { ok: false, error: "Only terminal leads (agreement_signed or not_interested) can be reopened." };
  }

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  try {
    let result: { ok: boolean; error?: string } = { ok: false };
    await db.transaction(async (tx) => {
      result = await reopenLead(
        tx,
        leadId,
        organizationId,
        lead.acquisitionStage,
        reason,
        actorUserId,
        { projectId, ownerId: lead.ownerId }
      );
    });
    return result;
  } catch (err) {
    console.error("[lead-actions] reopenLeadAction failed:", err);
    return { ok: false, error: "Could not reopen lead. Please try again." };
  }
}

// ─── updateNegotiationAction ──────────────────────────────────────────────────

export async function updateNegotiationAction(
  leadId: string,
  projectId: string,
  terms: NegotiationUpdate,
  changeSummary: string
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, leadId, organizationId, projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  try {
    await db.transaction(async (tx) => {
      await updateLeadNegotiation(tx, leadId, organizationId, terms);
      // Always append a NEW activity — never overwrite history
      await appendLeadActivity(tx, {
        organizationId,
        projectId,
        leadId,
        ownerId: lead.ownerId,
        activityType: "negotiation",
        notes: changeSummary || "Negotiation terms updated.",
        actorUserId,
      });
    });
    return { ok: true };
  } catch (err) {
    console.error("[lead-actions] updateNegotiationAction failed:", err);
    return { ok: false, error: "Could not save negotiation terms. Please try again." };
  }
}

// ─── updateOwnerContactAction ─────────────────────────────────────────────────

export async function updateOwnerContactAction(
  ownerId: string,
  projectId: string,
  update: OwnerContactUpdate
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  try {
    await updateOwnerContact(db, ownerId, organizationId, update);
    return { ok: true };
  } catch (err) {
    console.error("[lead-actions] updateOwnerContactAction failed:", err);
    return { ok: false, error: "Could not update owner contact." };
  }
}

// ─── securePropertyAction ─────────────────────────────────────────────────────

export interface SecurePropertyFormInput {
  leadId: string;
  projectId: string;
  agreementType: string;
  agreedMonthlyRent: number;
  agreedDeposit: number | null;
  leaseStartDate: string;
  leaseTermMonths: number | null;
  signedDate: string;
  agreementReference: string | null;
  explicitConfirmation: boolean;
}

function computeLeaseEndDate(startDate: string, months: number | null): string | null {
  if (!months) return null;
  try {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

// ─── getShowingStateAction ────────────────────────────────────────────────────

export async function getShowingStateAction(
  leadId: string,
  projectId: string
): Promise<{ ok: boolean; showing: import("@/lib/repository-leads").ActiveShowingView | null; error?: string }> {
  const { organizationId } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, showing: null, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { ok: false, showing: null, error: "Project not found." };

  try {
    const { getActiveShowing } = await import("@/lib/repository-leads");
    const showing = await getActiveShowing(leadId, organizationId);
    return { ok: true, showing };
  } catch (err) {
    console.error("[lead-actions] getShowingStateAction failed:", err);
    return { ok: false, showing: null, error: "Could not load showing state." };
  }
}

// ─── scheduleShowingAction ────────────────────────────────────────────────────

export interface ScheduleShowingInput {
  projectId: string;
  leadId: string;
  date: string;
  time: string;
  location: string;
  ownerName: string;
  userNotes: string | null;
  isReschedule?: boolean;
}

export async function scheduleShowingAction(
  input: ScheduleShowingInput
): Promise<{ ok: boolean; error?: string }> {
  if (!input.date) return { ok: false, error: "Showing date is required." };
  if (!input.time) return { ok: false, error: "Showing time is required." };
  if (!input.location.trim()) return { ok: false, error: "Meeting location is required." };

  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(input.projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, input.leadId, organizationId, input.projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  try {
    await db.transaction(async (tx) => {
      const showingData: ShowingData = {
        date: input.date,
        time: input.time,
        location: input.location.trim(),
        ownerName: input.ownerName.trim(),
        userNotes: input.userNotes?.trim() || null,
      };

      const activityType = input.isReschedule ? "showing_rescheduled" : "showing_scheduled";
      const label = input.isReschedule ? "🔄 Showing Rescheduled" : "📅 Showing Scheduled";

      await appendLeadActivity(tx, {
        organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        activityType,
        notes: JSON.stringify(showingData),
        outcome: `${label} — ${input.date} at ${input.time} · ${input.location.trim()}`,
        actorUserId,
      });

      // Create or update the single showing task (reschedule updates the existing one).
      await createOrUpdateShowingTask(
        tx,
        organizationId,
        input.projectId,
        input.leadId,
        input.date,
        lead.address
      );
    });
    return { ok: true };
  } catch (err) {
    console.error("[lead-actions] scheduleShowingAction failed:", err);
    return { ok: false, error: "Could not schedule showing. Please try again." };
  }
}

// ─── cancelShowingAction ──────────────────────────────────────────────────────

export interface CancelShowingInput {
  projectId: string;
  leadId: string;
  notes: string | null;
}

export async function cancelShowingAction(
  input: CancelShowingInput
): Promise<{ ok: boolean; error?: string }> {
  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(input.projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, input.leadId, organizationId, input.projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  try {
    await db.transaction(async (tx) => {
      await appendLeadActivity(tx, {
        organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        activityType: "showing_cancelled",
        outcome: "❌ Showing Cancelled",
        notes: input.notes?.trim() || null,
        actorUserId,
      });
      await resolveShowingTask(tx, organizationId, input.projectId, input.leadId);
    });
    return { ok: true };
  } catch (err) {
    console.error("[lead-actions] cancelShowingAction failed:", err);
    return { ok: false, error: "Could not cancel showing. Please try again." };
  }
}

// ─── completeShowingAction ────────────────────────────────────────────────────

export interface CompleteShowingInput {
  projectId: string;
  leadId: string;
  /** "good_fit" | "needs_follow_up" | "not_suitable" | "owner_not_moving_forward" */
  outcomeKey: string;
  notes: string | null;
  /** If truthy, advance the lead stage to this value (validated server-side) */
  advanceTo: string | null;
}

export async function completeShowingAction(
  input: CompleteShowingInput
): Promise<{ ok: boolean; error?: string }> {
  const VALID_OUTCOME_KEYS = ["good_fit", "needs_follow_up", "not_suitable", "owner_not_moving_forward"];
  if (!VALID_OUTCOME_KEYS.includes(input.outcomeKey)) {
    return { ok: false, error: "Invalid showing outcome." };
  }

  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(input.projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, input.leadId, organizationId, input.projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  // Validate stage transition if requested.
  if (input.advanceTo && !isTransitionPermitted(lead.acquisitionStage, input.advanceTo)) {
    return {
      ok: false,
      error: `Stage transition from "${lead.acquisitionStage}" to "${input.advanceTo}" is not permitted.`,
    };
  }

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);

  const OUTCOME_LABELS: Record<string, string> = {
    good_fit: "Good Fit — Move Forward",
    needs_follow_up: "Needs Follow-up",
    not_suitable: "Property Not Suitable",
    owner_not_moving_forward: "Owner Not Moving Forward",
  };

  try {
    await db.transaction(async (tx) => {
      // 1. Append showing_completed activity.
      await appendLeadActivity(tx, {
        organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        activityType: "showing_completed",
        outcome: input.outcomeKey,
        notes: input.notes?.trim() || `Showing complete. Result: ${OUTCOME_LABELS[input.outcomeKey]}`,
        stageBefore: input.advanceTo ? lead.acquisitionStage : null,
        stageAfter: input.advanceTo ?? null,
        actorUserId,
      });

      // 2. Advance stage if requested (e.g. interested → negotiating, interested → follow_up, interested → not_interested).
      if (input.advanceTo) {
        await transitionLeadStage(
          tx,
          input.leadId,
          organizationId,
          lead.acquisitionStage,
          input.advanceTo,
          actorUserId,
          {
            projectId: input.projectId,
            ownerId: lead.ownerId,
            notes: `Stage advanced after showing — result: ${OUTCOME_LABELS[input.outcomeKey]}`,
          }
        );
      }

      // 3. Resolve (complete) the showing task.
      await resolveShowingTask(tx, organizationId, input.projectId, input.leadId);
    });
    return { ok: true };
  } catch (err) {
    console.error("[lead-actions] completeShowingAction failed:", err);
    return { ok: false, error: "Could not record showing outcome. Please try again." };
  }
}

export async function securePropertyAction(
  input: SecurePropertyFormInput
): Promise<{ ok: boolean; error?: string; propertyId?: string; alreadySecured?: boolean }> {
  if (!input.explicitConfirmation) {
    return { ok: false, error: "Explicit confirmation is required to secure a property." };
  }
  if (!input.agreedMonthlyRent || input.agreedMonthlyRent <= 0) {
    return { ok: false, error: "Agreed monthly rent is required." };
  }
  if (!input.leaseStartDate) return { ok: false, error: "Lease start date is required." };
  if (!input.signedDate) return { ok: false, error: "Signed date is required." };
  if (!input.agreementType) return { ok: false, error: "Agreement type is required." };

  const { organizationId, user } = await requireOrganization();
  const db = getDb();
  if (!db) return { ok: false, error: "Database unavailable." };

  const belongs = await projectBelongsToOrg(input.projectId, organizationId);
  if (!belongs) return { ok: false, error: "Project not found." };

  const lead = await loadAndVerifyLead(db, input.leadId, organizationId, input.projectId);
  if (!lead) return { ok: false, error: "Lead not found in this project." };

  // Allow re-submission only when lead is in negotiating or already agreement_signed.
  // Any other stage is an error.
  if (lead.acquisitionStage !== "negotiating" && lead.acquisitionStage !== "agreement_signed") {
    return { ok: false, error: "Lead must be in Negotiating stage to secure property." };
  }

  const actorUserId = await resolveActorUserId(db, user.clerkUserId);
  const leaseEndDate = computeLeaseEndDate(input.leaseStartDate, input.leaseTermMonths);

  try {
    let finalPropertyId = "";
    let isAlreadySecured = false;

    await db.transaction(async (tx) => {
      // ── Check inside transaction whether handoff is already complete ─────────
      // A completed handoff is detected by: lead.acquisitionStage = agreement_signed
      // AND an existing property record linked to this lead.
      // When both conditions hold, return the existing property and do nothing else.
      if (lead.acquisitionStage === "agreement_signed") {
        const existing = await checkExistingSecuredProperty(tx, input.leadId, organizationId);
        if (existing) {
          finalPropertyId = existing;
          isAlreadySecured = true;
          return; // exit transaction callback — no further writes
        }
      }

      // ── First submission: full handoff ────────────────────────────────────────
      const { propertyId } = await createOrUpdateSecuredProperty(tx, {
        organizationId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        propertyType: lead.propertyType,
        bedrooms: lead.bedrooms,
        bathrooms: lead.bathrooms,
        agreementType: input.agreementType,
        agreedMonthlyRent: input.agreedMonthlyRent,
        agreedDeposit: input.agreedDeposit,
        leaseStartDate: input.leaseStartDate,
        leaseEndDate,
        signedDate: input.signedDate,
        agreementReference: input.agreementReference,
      });
      finalPropertyId = propertyId;

      const now = new Date();
      await tx
        .update(propertyLeads)
        .set({ acquisitionStage: "agreement_signed", lastStageChangedAt: now, updatedAt: now })
        .where(and(eq(propertyLeads.id, input.leadId), eq(propertyLeads.organizationId, organizationId)));

      await appendLeadActivity(tx, {
        organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        activityType: "agreement",
        notes: `Agreement secured. Type: ${input.agreementType}. Rent: $${input.agreedMonthlyRent}/mo. Signed: ${input.signedDate}. Ref: ${input.agreementReference ?? "—"}`,
        actorUserId,
      });

      await appendLeadActivity(tx, {
        organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: lead.ownerId,
        activityType: "stage_change",
        stageBefore: "negotiating",
        stageAfter: "agreement_signed",
        notes: "Property secured — agreement signed.",
        actorUserId,
      });

      await advanceProjectToPreparingProperty(tx, input.projectId, organizationId, propertyId);
      await createPreparationTasks(tx, organizationId, input.projectId, input.leadId);
    });

    return { ok: true, propertyId: finalPropertyId, alreadySecured: isAlreadySecured };
  } catch (err) {
    console.error("[lead-actions] securePropertyAction failed:", err);
    return { ok: false, error: "Could not secure property. Please try again." };
  }
}
