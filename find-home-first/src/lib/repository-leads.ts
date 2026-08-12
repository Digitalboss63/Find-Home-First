/**
 * Lead Workspace repository — typed data-access layer for the Owner Outreach
 * → Secure Property workflow.
 *
 * SECURITY: Every function requires organizationId + projectId from the caller,
 * which must be derived from requireOrganization(). Never accept these from
 * client input.
 *
 * Server-only: never import from "use client" components.
 */
import "server-only";
import { eq, and, desc, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { getDb, type DrizzleDb } from "@/db/client";
import * as schemaModule from "@/db/schema";
import {
  propertyLeads,
  propertyOwners,
  propertyLeadActivities,
  properties,
  projects,
  projectStatusHistory,
  tasks,
  users,
} from "@/db/schema";
import { isTransitionPermitted, TERMINAL_STAGES } from "@/lib/lead-pipeline";

// Accept either the main db or a transaction object.
// PgTransaction second type param is the full schema; third is ExtractTablesWithRelations.
type TxOrDb = DrizzleDb | PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schemaModule,
  ExtractTablesWithRelations<typeof schemaModule>
>;

// ─── View types ───────────────────────────────────────────────────────────────

export interface LeadWorkspaceView {
  lead: LeadDetailView;
  owner: OwnerContactView | null;
  activities: LeadActivityView[];
  followUpTask: FollowUpTaskView | null;
}

export interface LeadDetailView {
  id: string;
  organizationId: string;
  projectId: string | null;
  ownerId: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  monthlyRent: string | null;
  listingStatus: string;
  listingDate: string | null;
  lastSeenDate: string | null;
  daysOnMarket: number | null;
  listingContact: string | null;
  listingPhone: string | null;
  listingEmail: string | null;
  source: string;
  externalId: string | null;
  sourceUrl: string | null;
  acquisitionStage: string;
  qualificationStatus: string;
  notes: string | null;
  opportunityScore: number | null;
  opportunitySignals: string | null;
  // Negotiation
  proposedMonthlyRent: string | null;
  ownerAskingRent: string | null;
  proposedDeposit: string | null;
  proposedLeaseTermMonths: number | null;
  proposedAgreementType: string | null;
  utilitiesResponsibility: string | null;
  furnishingResponsibility: string | null;
  maintenanceResponsibility: string | null;
  negotiationSummary: string | null;
  lastStageChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnerContactView {
  id: string;
  name: string;
  ownerType: string;
  phone: string | null;
  email: string | null;
  mailingAddress: string | null;
  mailingDiffersFromProperty: boolean | null;
  ownerOccupied: boolean | null;
  leadSource: string;
  notes: string | null;
  preferredContactMethod: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  contactSource: string | null;
}

export interface LeadActivityView {
  id: string;
  activityType: string;
  contactMethod: string | null;
  outcome: string | null;
  notes: string | null;
  stageBefore: string | null;
  stageAfter: string | null;
  nextFollowUpAt: string | null;
  actorName: string | null;
  createdAt: Date;
}

export interface FollowUpTaskView {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
}

// ─── getLeadWorkspace ─────────────────────────────────────────────────────────

/**
 * Loads the full lead workspace: lead detail, owner, activities, follow-up task.
 * organizationId and projectId MUST come from requireOrganization() + verified project.
 */
export async function getLeadWorkspace(
  leadId: string,
  organizationId: string,
  projectId: string
): Promise<LeadWorkspaceView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [lead, acts, task] = await Promise.all([
      _getLeadDetail(db, leadId, organizationId, projectId),
      _listActivities(db, leadId, organizationId),
      _getFollowUpTask(db, leadId, organizationId, projectId),
    ]);
    if (!lead) return null;

    let owner: OwnerContactView | null = null;
    if (lead.ownerId) {
      owner = await _getOwnerContact(db, lead.ownerId, organizationId);
    }

    return { lead, owner, activities: acts, followUpTask: task };
  } catch {
    console.warn("[repository-leads] getLeadWorkspace failed");
    return null;
  }
}



async function _getLeadDetail(
  db: TxOrDb,
  leadId: string,
  organizationId: string,
  projectId: string
): Promise<LeadDetailView | null> {
  const rows = await db
    .select()
    .from(propertyLeads)
    .where(
      and(
        eq(propertyLeads.id, leadId),
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    organizationId: r.organizationId,
    projectId: r.projectId ?? null,
    ownerId: r.ownerId ?? null,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    propertyType: r.propertyType,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    monthlyRent: r.monthlyRent,
    listingStatus: r.listingStatus,
    listingDate: r.listingDate,
    lastSeenDate: r.lastSeenDate,
    daysOnMarket: r.daysOnMarket,
    listingContact: r.listingContact,
    listingPhone: r.listingPhone,
    listingEmail: r.listingEmail,
    source: r.source,
    externalId: r.externalId,
    sourceUrl: r.sourceUrl,
    acquisitionStage: r.acquisitionStage,
    qualificationStatus: r.qualificationStatus,
    notes: r.notes,
    opportunityScore: r.opportunityScore,
    opportunitySignals: r.opportunitySignals,
    proposedMonthlyRent: r.proposedMonthlyRent,
    ownerAskingRent: r.ownerAskingRent,
    proposedDeposit: r.proposedDeposit,
    proposedLeaseTermMonths: r.proposedLeaseTermMonths,
    proposedAgreementType: r.proposedAgreementType,
    utilitiesResponsibility: r.utilitiesResponsibility,
    furnishingResponsibility: r.furnishingResponsibility,
    maintenanceResponsibility: r.maintenanceResponsibility,
    negotiationSummary: r.negotiationSummary,
    lastStageChangedAt: r.lastStageChangedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function _getOwnerContact(
  db: TxOrDb,
  ownerId: string,
  organizationId: string
): Promise<OwnerContactView | null> {
  const rows = await db
    .select({
      id: propertyOwners.id,
      name: propertyOwners.name,
      ownerType: propertyOwners.ownerType,
      phone: propertyOwners.phone,
      email: propertyOwners.email,
      mailingAddress: propertyOwners.mailingAddress,
      mailingDiffersFromProperty: propertyOwners.mailingDiffersFromProperty,
      ownerOccupied: propertyOwners.ownerOccupied,
      leadSource: propertyOwners.leadSource,
      notes: propertyOwners.notes,
      preferredContactMethod: propertyOwners.preferredContactMethod,
      phoneVerifiedAt: propertyOwners.phoneVerifiedAt,
      emailVerifiedAt: propertyOwners.emailVerifiedAt,
      contactSource: propertyOwners.contactSource,
    })
    .from(propertyOwners)
    .where(
      and(
        eq(propertyOwners.id, ownerId),
        eq(propertyOwners.organizationId, organizationId)
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    ownerType: r.ownerType,
    phone: r.phone,
    email: r.email,
    mailingAddress: r.mailingAddress,
    mailingDiffersFromProperty: r.mailingDiffersFromProperty,
    ownerOccupied: r.ownerOccupied,
    leadSource: r.leadSource,
    notes: r.notes,
    preferredContactMethod: r.preferredContactMethod,
    phoneVerifiedAt: r.phoneVerifiedAt,
    emailVerifiedAt: r.emailVerifiedAt,
    contactSource: r.contactSource,
  };
}

async function _listActivities(
  db: TxOrDb,
  leadId: string,
  organizationId: string
): Promise<LeadActivityView[]> {
  const rows = await db
    .select({
      id: propertyLeadActivities.id,
      activityType: propertyLeadActivities.activityType,
      contactMethod: propertyLeadActivities.contactMethod,
      outcome: propertyLeadActivities.outcome,
      notes: propertyLeadActivities.notes,
      stageBefore: propertyLeadActivities.stageBefore,
      stageAfter: propertyLeadActivities.stageAfter,
      nextFollowUpAt: propertyLeadActivities.nextFollowUpAt,
      actorName: users.name,
      createdAt: propertyLeadActivities.createdAt,
    })
    .from(propertyLeadActivities)
    .leftJoin(users, eq(propertyLeadActivities.actorUserId, users.id))
    .where(
      and(
        eq(propertyLeadActivities.leadId, leadId),
        eq(propertyLeadActivities.organizationId, organizationId)
      )
    )
    .orderBy(desc(propertyLeadActivities.createdAt));

  return rows.map((r) => ({
    id: r.id,
    activityType: r.activityType,
    contactMethod: r.contactMethod,
    outcome: r.outcome,
    notes: r.notes,
    stageBefore: r.stageBefore,
    stageAfter: r.stageAfter,
    nextFollowUpAt: r.nextFollowUpAt,
    actorName: r.actorName ?? null,
    createdAt: r.createdAt,
  }));
}

async function _getFollowUpTask(
  db: TxOrDb,
  leadId: string,
  organizationId: string,
  projectId: string
): Promise<FollowUpTaskView | null> {
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, status: tasks.status })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, organizationId),
        eq(tasks.projectId, projectId),
        eq(tasks.leadId, leadId),
        eq(tasks.status, "upcoming"),
        sql`${tasks.title} LIKE 'Follow-up%'`
      )
    )
    .limit(1);
  if (rows.length === 0) return null;
  return { id: rows[0].id, title: rows[0].title, dueDate: rows[0].dueDate, status: rows[0].status };
}

// ─── listLeadActivities ───────────────────────────────────────────────────────

export async function listLeadActivities(
  leadId: string,
  organizationId: string
): Promise<LeadActivityView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    return await _listActivities(db, leadId, organizationId);
  } catch {
    console.warn("[repository-leads] listLeadActivities failed");
    return null;
  }
}

// ─── appendLeadActivity ───────────────────────────────────────────────────────

export interface AppendActivityInput {
  organizationId: string;
  projectId: string;
  leadId: string;
  ownerId: string | null;
  activityType: string;
  contactMethod?: string | null;
  outcome?: string | null;
  notes?: string | null;
  stageBefore?: string | null;
  stageAfter?: string | null;
  nextFollowUpAt?: string | null;
  actorUserId?: string | null;
}

export async function appendLeadActivity(
  db: TxOrDb,
  input: AppendActivityInput
): Promise<string | null> {
  try {
    const inserted = await db
      .insert(propertyLeadActivities)
      .values({
        organizationId: input.organizationId,
        projectId: input.projectId,
        leadId: input.leadId,
        ownerId: input.ownerId ?? null,
        activityType: input.activityType,
        contactMethod: input.contactMethod ?? null,
        outcome: input.outcome ?? null,
        notes: input.notes ?? null,
        stageBefore: input.stageBefore ?? null,
        stageAfter: input.stageAfter ?? null,
        nextFollowUpAt: input.nextFollowUpAt ?? null,
        actorUserId: input.actorUserId ?? null,
        createdAt: new Date(),
      })
      .returning({ id: propertyLeadActivities.id });
    return inserted[0]?.id ?? null;
  } catch (err) {
    console.warn("[repository-leads] appendLeadActivity failed:", err);
    return null;
  }
}

// ─── updateLeadNegotiation ────────────────────────────────────────────────────

export interface NegotiationUpdate {
  proposedMonthlyRent?: number;
  ownerAskingRent?: number;
  proposedDeposit?: number;
  proposedLeaseTermMonths?: number;
  proposedAgreementType?: string;
  utilitiesResponsibility?: string;
  furnishingResponsibility?: string;
  maintenanceResponsibility?: string;
  negotiationSummary?: string;
}

export async function updateLeadNegotiation(
  db: TxOrDb,
  leadId: string,
  organizationId: string,
  terms: NegotiationUpdate
): Promise<boolean> {
  try {
    type PatchType = {
      updatedAt: Date;
      proposedMonthlyRent?: string;
      ownerAskingRent?: string;
      proposedDeposit?: string;
      proposedLeaseTermMonths?: number;
      proposedAgreementType?: string;
      utilitiesResponsibility?: string;
      furnishingResponsibility?: string;
      maintenanceResponsibility?: string;
      negotiationSummary?: string;
    };
    const patch: PatchType = { updatedAt: new Date() };
    if (terms.proposedMonthlyRent !== undefined) patch.proposedMonthlyRent = String(terms.proposedMonthlyRent);
    if (terms.ownerAskingRent !== undefined) patch.ownerAskingRent = String(terms.ownerAskingRent);
    if (terms.proposedDeposit !== undefined) patch.proposedDeposit = String(terms.proposedDeposit);
    if (terms.proposedLeaseTermMonths !== undefined) patch.proposedLeaseTermMonths = terms.proposedLeaseTermMonths;
    if (terms.proposedAgreementType !== undefined) patch.proposedAgreementType = terms.proposedAgreementType;
    if (terms.utilitiesResponsibility !== undefined) patch.utilitiesResponsibility = terms.utilitiesResponsibility;
    if (terms.furnishingResponsibility !== undefined) patch.furnishingResponsibility = terms.furnishingResponsibility;
    if (terms.maintenanceResponsibility !== undefined) patch.maintenanceResponsibility = terms.maintenanceResponsibility;
    if (terms.negotiationSummary !== undefined) patch.negotiationSummary = terms.negotiationSummary;

    await db
      .update(propertyLeads)
      .set(patch)
      .where(
        and(
          eq(propertyLeads.id, leadId),
          eq(propertyLeads.organizationId, organizationId)
        )
      );
    return true;
  } catch (err) {
    console.warn("[repository-leads] updateLeadNegotiation failed:", err);
    return false;
  }
}

// ─── updateOwnerContact ───────────────────────────────────────────────────────

export interface OwnerContactUpdate {
  phone?: string | null;
  email?: string | null;
  preferredContactMethod?: string | null;
  phoneVerifiedAt?: Date | null;
  emailVerifiedAt?: Date | null;
  contactSource?: string | null;
}

export async function updateOwnerContact(
  db: TxOrDb,
  ownerId: string,
  organizationId: string,
  update: OwnerContactUpdate
): Promise<boolean> {
  try {
    type PatchType = {
      updatedAt: Date;
      phone?: string | null;
      email?: string | null;
      preferredContactMethod?: string | null;
      phoneVerifiedAt?: Date | null;
      emailVerifiedAt?: Date | null;
      contactSource?: string | null;
    };
    const patch: PatchType = { updatedAt: new Date() };
    if ("phone" in update) patch.phone = update.phone ?? null;
    if ("email" in update) patch.email = update.email ?? null;
    if ("preferredContactMethod" in update) patch.preferredContactMethod = update.preferredContactMethod ?? null;
    if ("phoneVerifiedAt" in update) patch.phoneVerifiedAt = update.phoneVerifiedAt ?? null;
    if ("emailVerifiedAt" in update) patch.emailVerifiedAt = update.emailVerifiedAt ?? null;
    if ("contactSource" in update) patch.contactSource = update.contactSource ?? null;

    await db
      .update(propertyOwners)
      .set(patch)
      .where(
        and(
          eq(propertyOwners.id, ownerId),
          eq(propertyOwners.organizationId, organizationId)
        )
      );
    return true;
  } catch (err) {
    console.warn("[repository-leads] updateOwnerContact failed:", err);
    return false;
  }
}

// ─── transitionLeadStage ──────────────────────────────────────────────────────

/**
 * Atomically transitions a lead stage.
 * Validates the permitted transition, updates the lead, appends a stage_change activity.
 * Caller must provide an open transaction (tx) for atomicity.
 */
export async function transitionLeadStage(
  tx: TxOrDb,
  leadId: string,
  organizationId: string,
  fromStage: string,
  toStage: string,
  actorUserId: string | null,
  activityExtras?: { projectId: string; ownerId: string | null; notes?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isTransitionPermitted(fromStage, toStage)) {
    return { ok: false, error: `Stage transition from "${fromStage}" to "${toStage}" is not permitted.` };
  }
  const now = new Date();
  await tx
    .update(propertyLeads)
    .set({ acquisitionStage: toStage, lastStageChangedAt: now, updatedAt: now })
    .where(and(eq(propertyLeads.id, leadId), eq(propertyLeads.organizationId, organizationId)));

  if (activityExtras) {
    await appendLeadActivity(tx, {
      organizationId,
      projectId: activityExtras.projectId,
      leadId,
      ownerId: activityExtras.ownerId,
      activityType: "stage_change",
      stageBefore: fromStage,
      stageAfter: toStage,
      notes: activityExtras.notes,
      actorUserId,
    });
  }
  return { ok: true };
}

// ─── reopenLead ───────────────────────────────────────────────────────────────

/**
 * Reopens a terminal lead to "researching" stage.
 * Requires non-empty reason; verifies terminal stage; appends stage_change activity.
 * Caller provides open transaction.
 */
export async function reopenLead(
  tx: TxOrDb,
  leadId: string,
  organizationId: string,
  currentStage: string,
  reason: string,
  actorUserId: string | null,
  activityExtras: { projectId: string; ownerId: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (!TERMINAL_STAGES.has(currentStage)) {
    return { ok: false, error: "Only terminal leads (agreement_signed or not_interested) can be reopened." };
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: "A reason is required to reopen a terminal lead." };
  }
  const now = new Date();
  await tx
    .update(propertyLeads)
    .set({ acquisitionStage: "researching", lastStageChangedAt: now, updatedAt: now })
    .where(and(eq(propertyLeads.id, leadId), eq(propertyLeads.organizationId, organizationId)));

  await appendLeadActivity(tx, {
    organizationId,
    projectId: activityExtras.projectId,
    leadId,
    ownerId: activityExtras.ownerId,
    activityType: "stage_change",
    stageBefore: currentStage,
    stageAfter: "researching",
    notes: `Reopened: ${reason.trim()}`,
    actorUserId,
  });
  return { ok: true };
}

// ─── createLeadFollowUpTask ───────────────────────────────────────────────────

/**
 * Creates or updates a follow-up task for a lead.
 * Idempotent: finds existing open follow-up task for this lead and updates it.
 */
export async function createLeadFollowUpTask(
  tx: TxOrDb,
  organizationId: string,
  projectId: string,
  leadId: string,
  dueDate: string,
  address: string
): Promise<string | null> {
  try {
    const TITLE_PREFIX = `Follow-up:`;
    const title = `${TITLE_PREFIX} ${address}`.slice(0, 200);

    const existing = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          eq(tasks.projectId, projectId),
          eq(tasks.leadId, leadId),
          eq(tasks.status, "upcoming"),
          sql`${tasks.title} LIKE 'Follow-up%'`
        )
      )
      .limit(1);

    const now = new Date();
    if (existing.length > 0) {
      await tx
        .update(tasks)
        .set({ dueDate, updatedAt: now })
        .where(eq(tasks.id, existing[0].id));
      return existing[0].id;
    }

    const inserted = await tx
      .insert(tasks)
      .values({
        organizationId,
        projectId,
        leadId,
        title,
        description: `Follow-up contact for property lead at ${address}`,
        dueDate,
        status: "upcoming",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: tasks.id });
    return inserted[0]?.id ?? null;
  } catch (err) {
    console.warn("[repository-leads] createLeadFollowUpTask failed:", err);
    return null;
  }
}

// ─── createOrUpdateSecuredProperty ───────────────────────────────────────────

export interface SecurePropertyInput {
  organizationId: string;
  leadId: string;
  ownerId: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  agreementType: string;
  agreedMonthlyRent: number;
  agreedDeposit: number | null;
  leaseStartDate: string;
  leaseEndDate: string | null;
  signedDate: string;
  agreementReference: string | null;
}

export const PREPARATION_TASKS = [
  "Verify agreement and insurance documentation",
  "Complete property condition and move-in inspection",
  "Confirm utilities and service activation",
  "Complete safety, habitability, and accessibility review",
  "Prepare furnishing and private-room setup plan",
] as const;

export async function createOrUpdateSecuredProperty(
  tx: TxOrDb,
  input: SecurePropertyInput
): Promise<{ propertyId: string; created: boolean }> {
  const now = new Date();

  // Find existing property linked to this lead (idempotent)
  const existing = await tx
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.leadId, input.leadId),
        eq(properties.organizationId, input.organizationId)
      )
    )
    .limit(1);

  const propValues = {
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    propertyType: input.propertyType,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    monthlyRent: String(input.agreedMonthlyRent),
    deposit: input.agreedDeposit !== null ? String(input.agreedDeposit) : null,
    agreementType: input.agreementType,
    leaseStartDate: input.leaseStartDate,
    leaseEndDate: input.leaseEndDate,
    readinessStatus: "preparing",
    agreementStatus: "signed",
    agreementSignedDate: input.signedDate,
    agreementReference: input.agreementReference,
    leadId: input.leadId,
    ownerId: input.ownerId,
    updatedAt: now,
  };

  if (existing.length > 0) {
    await tx
      .update(properties)
      .set(propValues)
      .where(eq(properties.id, existing[0].id));
    return { propertyId: existing[0].id, created: false };
  }

  const inserted = await tx
    .insert(properties)
    .values({ organizationId: input.organizationId, ...propValues, createdAt: now })
    .returning({ id: properties.id });
  return { propertyId: inserted[0].id, created: true };
}

export async function createPreparationTasks(
  tx: TxOrDb,
  organizationId: string,
  projectId: string,
  leadId: string
): Promise<number> {
  const existing = await tx
    .select({ title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.projectId, projectId)))
    .limit(500);

  const existingTitles = new Set(existing.map((r) => r.title));
  let created = 0;
  const now = new Date();

  for (const title of PREPARATION_TASKS) {
    if (!existingTitles.has(title)) {
      await tx.insert(tasks).values({
        organizationId,
        projectId,
        leadId,
        title,
        status: "upcoming",
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
  }
  return created;
}

/**
 * Returns the existing secured property ID for a lead, or null if none exists.
 * Used inside the securePropertyAction transaction to detect completed handoffs.
 */
export async function checkExistingSecuredProperty(
  tx: TxOrDb,
  leadId: string,
  organizationId: string
): Promise<string | null> {
  const rows = await tx
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.leadId, leadId),
        eq(properties.organizationId, organizationId)
      )
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function advanceProjectToPreparingProperty(
  tx: TxOrDb,
  projectId: string,
  organizationId: string,
  propertyId: string
): Promise<void> {
  const projectRows = await tx
    .select({ currentStatus: projects.currentStatus })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
    .limit(1);

  const previousStatus = projectRows[0]?.currentStatus ?? null;
  const now = new Date();

  await tx
    .update(projects)
    .set({ propertyId, currentStatus: "preparing_property", updatedAt: now })
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));

  await tx.insert(projectStatusHistory).values({
    projectId,
    previousStatus,
    newStatus: "preparing_property",
    reason: "Property secured — agreement signed.",
    changedAt: now,
  });
}

export async function resolveActorUserId(
  db: TxOrDb,
  clerkUserId: string
): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}
