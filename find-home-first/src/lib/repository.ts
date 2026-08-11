/**
 * Repository — typed data-access layer.
 *
 * SECURITY: All org-scoped functions require organizationId from
 * requireOrganization(). Never pass organizationId from client input.
 * Platform-level functions require requirePlatformOwner() in the caller.
 *
 * Demo fallback only in development or DEMO_MODE=true.
 * Production failures return null — callers must redirect /unavailable.
 *
 * Server-only: never import from client components.
 */
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  projects,
  tasks,
  contacts,
  residents,
  propertyLeads,
  propertyOwners,
  propertySearchDrafts,
  platformSettings,
  auditLog,
  projectMarketResearch,
} from "@/db/schema";
import { statusToStageKey } from "./stages";

const referralContacts = contacts;

// ─── Demo safety ─────────────────────────────────────────────────────────────

export function isDemoAllowed(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.DEMO_MODE === "true"
  );
}

// ─── View types ───────────────────────────────────────────────────────────────

export interface ProjectView {
  id: string;
  name: string;
  community: string;
  currentStatus: string;
  currentStage: string;
  targetMoveIn: string | null;
  blocker: string | null;
  blockerReason: string | null;
  nextAction: string | null;
  residentName: string | null;
  groupStatus: "active" | "completed" | "closed";
  createdAt: Date;
}

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  dueDate: string | null;
  status: string;
}

export interface ContactView {
  id: string;
  name: string;
  organizationName: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  contactType: string;
}

export interface ResidentView {
  id: string;
  displayName: string;
  householdSize: number;
  bedroomsNeeded: number;
  accessibilityNeeds: string | null;
  incomeRange: string | null;
  notes: string | null;
  placementStatus: string;
  referralContactId: string | null;
  referredByName: string | null;
}

export interface PropertyLeadView {
  id: string;
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
  qualificationReason: string | null;
  followUpDate: string | null;
  notes: string | null;
  ownerId: string | null;
  projectId: string | null;
  opportunityScore: number | null;
  opportunitySignals: string | null;
}

export interface PropertyOwnerView {
  id: string;
  name: string;
  ownerType: string;
  phone: string | null;
  email: string | null;
  mailingAddress: string | null;
  mailingDiffersFromProperty: boolean | null;
  ownerOccupied: boolean | null;
  motivationNotes: string | null;
  outreachStatus: string;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  lastResponse: string | null;
  leadSource: string;
  notes: string | null;
}

export interface PropertySearchDraftView {
  /** Required project scope — must be a valid project ID. */
  projectId: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  minBedrooms: string;
  minBathrooms: string;
  maxRent: string;
  maxDaysListed: string;
  listingStatus: string;
  submitted: boolean;
  lastSearchAt: Date | null;
  /** JSON string of normalized RentCast result snapshot. */
  resultsSnapshot: string | null;
  resultsCount: number;
  queryFingerprint: string | null;
  mapLatitude: string | null;
  mapLongitude: string | null;
  mapRadiusMi: number | null;
  mapMode: string;
}

export interface PlatformSettingView {
  settingKey: string;
  value: string | null;
  enabled: boolean;
  updatedByClerkUserId: string | null;
  updatedAt: Date;
}

export interface AuditLogView {
  id: string;
  actorClerkUserId: string | null;
  actorEmail: string | null;
  eventType: string;
  detail: string | null;
  organizationId: string | null;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveGroupStatus(s: string): "active" | "completed" | "closed" {
  if (s === "moved_in") return "completed";
  if (s === "closed_not_proceeding") return "closed";
  return "active";
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(
  organizationId: string
): Promise<ProjectView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        community: projects.community,
        currentStatus: projects.currentStatus,
        targetMoveIn: projects.targetMoveIn,
        blocker: projects.blocker,
        blockerReason: projects.blockerReason,
        nextAction: projects.nextAction,
        residentDisplayName: residents.displayName,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(residents, eq(projects.residentId, residents.id))
      .where(eq(projects.organizationId, organizationId))
      .orderBy(projects.createdAt);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      community: r.community,
      currentStatus: r.currentStatus,
      currentStage: statusToStageKey(r.currentStatus),
      targetMoveIn: r.targetMoveIn,
      blocker: r.blocker,
      blockerReason: r.blockerReason,
      nextAction: r.nextAction,
      residentName: r.residentDisplayName ?? null,
      groupStatus: deriveGroupStatus(r.currentStatus),
      createdAt: r.createdAt,
    }));
  } catch {
    console.warn("[repository] listProjects failed");
    return null;
  }
}

export async function listActiveProjects(
  organizationId: string
): Promise<ProjectView[] | null> {
  const all = await listProjects(organizationId);
  if (!all) return null;
  return all.filter((p) => p.groupStatus === "active");
}

export async function getProjectById(
  id: string,
  organizationId: string
): Promise<ProjectView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        community: projects.community,
        currentStatus: projects.currentStatus,
        targetMoveIn: projects.targetMoveIn,
        blocker: projects.blocker,
        blockerReason: projects.blockerReason,
        nextAction: projects.nextAction,
        residentDisplayName: residents.displayName,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(residents, eq(projects.residentId, residents.id))
      .where(
        and(eq(projects.id, id), eq(projects.organizationId, organizationId))
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      community: r.community,
      currentStatus: r.currentStatus,
      currentStage: statusToStageKey(r.currentStatus),
      targetMoveIn: r.targetMoveIn,
      blocker: r.blocker,
      blockerReason: r.blockerReason,
      nextAction: r.nextAction,
      residentName: r.residentDisplayName ?? null,
      groupStatus: deriveGroupStatus(r.currentStatus),
      createdAt: r.createdAt,
    };
  } catch {
    console.warn("[repository] getProjectById failed");
    return null;
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(
  organizationId: string
): Promise<TaskView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        projectId: tasks.projectId,
        projectName: projects.name,
        dueDate: tasks.dueDate,
        status: tasks.status,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.organizationId, organizationId))
      .orderBy(tasks.dueDate);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      projectId: r.projectId,
      projectName: r.projectName ?? null,
      dueDate: r.dueDate,
      status: r.status,
    }));
  } catch {
    console.warn("[repository] listTasks failed");
    return null;
  }
}

export async function listTasksForProject(
  projectId: string,
  organizationId: string
): Promise<TaskView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        projectId: tasks.projectId,
        projectName: projects.name,
        dueDate: tasks.dueDate,
        status: tasks.status,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.projectId, projectId),
          eq(tasks.organizationId, organizationId)
        )
      )
      .orderBy(tasks.dueDate);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      projectId: r.projectId,
      projectName: r.projectName ?? null,
      dueDate: r.dueDate,
      status: r.status,
    }));
  } catch {
    console.warn("[repository] listTasksForProject failed");
    return null;
  }
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(
  organizationId: string
): Promise<ContactView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        organizationName: contacts.organizationName,
        roleTitle: contacts.roleTitle,
        email: contacts.email,
        phone: contacts.phone,
        notes: contacts.notes,
        contactType: contacts.contactType,
      })
      .from(contacts)
      .where(eq(contacts.organizationId, organizationId))
      .orderBy(contacts.name);

    return rows;
  } catch {
    console.warn("[repository] listContacts failed");
    return null;
  }
}

// ─── Residents ────────────────────────────────────────────────────────────────

export async function listResidents(
  organizationId: string
): Promise<ResidentView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: residents.id,
        displayName: residents.displayName,
        householdSize: residents.householdSize,
        bedroomsNeeded: residents.bedroomsNeeded,
        accessibilityNeeds: residents.accessibilityNeeds,
        incomeRange: residents.incomeRange,
        notes: residents.notes,
        placementStatus: residents.placementStatus,
        referralContactId: residents.referralContactId,
        referredByName: referralContacts.name,
      })
      .from(residents)
      .leftJoin(
        referralContacts,
        eq(residents.referralContactId, referralContacts.id)
      )
      .where(eq(residents.organizationId, organizationId))
      .orderBy(residents.displayName);

    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      householdSize: r.householdSize,
      bedroomsNeeded: r.bedroomsNeeded,
      accessibilityNeeds: r.accessibilityNeeds,
      incomeRange: r.incomeRange,
      notes: r.notes,
      placementStatus: r.placementStatus,
      referralContactId: r.referralContactId,
      referredByName: r.referredByName ?? null,
    }));
  } catch {
    console.warn("[repository] listResidents failed");
    return null;
  }
}

// ─── Property Leads ───────────────────────────────────────────────────────────

export async function listPropertyLeads(
  organizationId: string
): Promise<PropertyLeadView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(propertyLeads)
      .where(eq(propertyLeads.organizationId, organizationId))
      .orderBy(desc(propertyLeads.createdAt));

    return rows.map((r) => ({
      id: r.id,
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
      qualificationReason: r.qualificationReason,
      followUpDate: r.followUpDate,
      notes: r.notes,
      ownerId: r.ownerId,
      projectId: r.projectId ?? null,
      opportunityScore: r.opportunityScore ?? null,
      opportunitySignals: r.opportunitySignals ?? null,
    }));
  } catch {
    console.warn("[repository] listPropertyLeads failed");
    return null;
  }
}

export interface SavePropertyLeadInput {
  source: string;
  externalId?: string;
  sourceUrl?: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  monthlyRent?: number;
  listingStatus?: string;
  listingDate?: string;
  lastSeenDate?: string;
  daysOnMarket?: number;
  listingContact?: string;
  listingPhone?: string;
  listingEmail?: string;
  notes?: string;
  projectId?: string;
  opportunityScore?: number;
  opportunitySignals?: string;
}

// ─── Dedup helpers ────────────────────────────────────────────────────────────

function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase().trim();
  }
}

/**
 * Saves a property lead. Prevents duplicates by externalId, normalizedSourceUrl, and normalizedAddress.
 * Returns { id, duplicate: false } on success, { id, duplicate: true } if already exists.
 */
export async function savePropertyLead(
  organizationId: string,
  input: SavePropertyLeadInput
): Promise<{ id: string; duplicate: boolean } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const normalizedAddr = input.address ? normalizeAddress(input.address) : null;
    const normalizedSrcUrl = input.sourceUrl ? normalizeUrl(input.sourceUrl) : null;

    // Dedup logic: project-scoped when projectId is provided, org-only for legacy
    const useProjectScope = !!input.projectId;

    // Check duplicate by externalId
    if (input.externalId) {
      const existing = await db
        .select({ id: propertyLeads.id })
        .from(propertyLeads)
        .where(
          and(
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.externalId, input.externalId)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        if (!useProjectScope) return { id: existing[0].id, duplicate: true };
        // Check if the existing lead belongs to the same project
        const sameProject = await db.select({ id: propertyLeads.id }).from(propertyLeads)
          .where(and(
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.externalId, input.externalId),
            eq(propertyLeads.projectId, input.projectId!)
          )).limit(1);
        if (sameProject.length > 0) return { id: sameProject[0].id, duplicate: true };
      }
    }

    // Check duplicate by normalizedSourceUrl
    if (normalizedSrcUrl) {
      const existing = await db
        .select({ id: propertyLeads.id })
        .from(propertyLeads)
        .where(
          and(
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.normalizedSourceUrl, normalizedSrcUrl)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        if (!useProjectScope) return { id: existing[0].id, duplicate: true };
        const sameProject = await db.select({ id: propertyLeads.id }).from(propertyLeads)
          .where(and(
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.normalizedSourceUrl, normalizedSrcUrl),
            eq(propertyLeads.projectId, input.projectId!)
          )).limit(1);
        if (sameProject.length > 0) return { id: sameProject[0].id, duplicate: true };
      }
    }

    // Check duplicate by normalizedAddress
    if (normalizedAddr) {
      const existing = await db
        .select({ id: propertyLeads.id })
        .from(propertyLeads)
        .where(
          and(
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.normalizedAddress, normalizedAddr)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        if (!useProjectScope) return { id: existing[0].id, duplicate: true };
        const sameProject = await db.select({ id: propertyLeads.id }).from(propertyLeads)
          .where(and(
            eq(propertyLeads.organizationId, organizationId),
            eq(propertyLeads.normalizedAddress, normalizedAddr),
            eq(propertyLeads.projectId, input.projectId!)
          )).limit(1);
        if (sameProject.length > 0) return { id: sameProject[0].id, duplicate: true };
      }
    }

    const inserted = await db
      .insert(propertyLeads)
      .values({
        organizationId,
        source: input.source,
        externalId: input.externalId ?? null,
        sourceUrl: input.sourceUrl ?? null,
        normalizedAddress: normalizedAddr,
        normalizedSourceUrl: normalizedSrcUrl,
        address: input.address,
        city: input.city ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        propertyType: input.propertyType ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms != null ? String(input.bathrooms) : null,
        monthlyRent:
          input.monthlyRent != null ? String(input.monthlyRent) : null,
        listingStatus: input.listingStatus ?? "active",
        listingDate: input.listingDate ?? null,
        lastSeenDate: input.lastSeenDate ?? null,
        daysOnMarket: input.daysOnMarket ?? null,
        listingContact: input.listingContact ?? null,
        listingPhone: input.listingPhone ?? null,
        listingEmail: input.listingEmail ?? null,
        notes: input.notes ?? null,
        projectId: input.projectId ?? null,
        opportunityScore: input.opportunityScore ?? null,
        opportunitySignals: input.opportunitySignals ?? null,
      })
      .returning({ id: propertyLeads.id });

    return { id: inserted[0].id, duplicate: false };
  } catch (err) {
    // If the insert fails due to a unique constraint violation (race condition),
    // treat it as a duplicate rather than an error.
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("unique") ||
      msg.includes("duplicate") ||
      msg.includes("23505") // PostgreSQL unique_violation error code
    ) {
      console.warn("[repository] savePropertyLead: duplicate constraint race — returning duplicate");
      // Re-query to get the existing ID
      try {
        const normalizedAddr = input.address ? normalizeAddress(input.address) : null;
        const normalizedSrcUrl = input.sourceUrl ? normalizeUrl(input.sourceUrl) : null;
        const db2 = getDb();
        if (db2 && normalizedAddr) {
          const existing = await db2
            .select({ id: propertyLeads.id })
            .from(propertyLeads)
            .where(
              and(
                eq(propertyLeads.organizationId, organizationId),
                eq(propertyLeads.normalizedAddress, normalizedAddr)
              )
            )
            .limit(1);
          if (existing.length > 0) return { id: existing[0].id, duplicate: true };
        }
        if (db2 && normalizedSrcUrl) {
          const existing = await db2
            .select({ id: propertyLeads.id })
            .from(propertyLeads)
            .where(
              and(
                eq(propertyLeads.organizationId, organizationId),
                eq(propertyLeads.normalizedSourceUrl, normalizedSrcUrl)
              )
            )
            .limit(1);
          if (existing.length > 0) return { id: existing[0].id, duplicate: true };
        }
      } catch {
        // best effort
      }
      return { id: "duplicate", duplicate: true };
    }
    console.warn("[repository] savePropertyLead failed:", msg);
    return null;
  }
}

// ─── Property Owners ─────────────────────────────────────────────────────────

export async function getPropertyOwner(
  ownerId: string,
  organizationId: string
): Promise<PropertyOwnerView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
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
      motivationNotes: r.motivationNotes,
      outreachStatus: r.outreachStatus,
      lastContactDate: r.lastContactDate,
      nextFollowUpDate: r.nextFollowUpDate,
      lastResponse: r.lastResponse,
      leadSource: r.leadSource,
      notes: r.notes,
    };
  } catch {
    console.warn("[repository] getPropertyOwner failed");
    return null;
  }
}

// ─── New property owner/lead functions ───────────────────────────────────────

export async function getPropertyOwnerByRentcastId(
  organizationId: string,
  rentcastPropertyId: string
): Promise<PropertyOwnerView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(propertyOwners)
      .where(and(
        eq(propertyOwners.organizationId, organizationId),
        eq(propertyOwners.rentcastPropertyId, rentcastPropertyId)
      ))
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
      motivationNotes: r.motivationNotes,
      outreachStatus: r.outreachStatus,
      lastContactDate: r.lastContactDate,
      nextFollowUpDate: r.nextFollowUpDate,
      lastResponse: r.lastResponse,
      leadSource: r.leadSource,
      notes: r.notes,
    };
  } catch {
    console.warn("[repository] getPropertyOwnerByRentcastId failed");
    return null;
  }
}

export interface UpsertPropertyOwnerInput {
  rentcastPropertyId?: string | null;
  name: string;
  ownerType?: string;
  phone?: string | null;
  email?: string | null;
  mailingAddress?: string | null;
  mailingDiffersFromProperty?: boolean | null;
  ownerOccupied?: boolean | null;
  motivationNotes?: string | null;
  leadSource?: string;
}

export async function upsertPropertyOwner(
  organizationId: string,
  input: UpsertPropertyOwnerInput
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  try {
    if (input.rentcastPropertyId) {
      const existing = await db
        .select({ id: propertyOwners.id })
        .from(propertyOwners)
        .where(and(
          eq(propertyOwners.organizationId, organizationId),
          eq(propertyOwners.rentcastPropertyId, input.rentcastPropertyId)
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(propertyOwners)
          .set({
            name: input.name,
            ownerType: input.ownerType ?? "unknown",
            mailingAddress: input.mailingAddress ?? null,
            mailingDiffersFromProperty: input.mailingDiffersFromProperty ?? null,
            ownerOccupied: input.ownerOccupied ?? null,
            motivationNotes: input.motivationNotes ?? null,
            leadSource: input.leadSource ?? "rentcast",
            updatedAt: new Date(),
          })
          .where(eq(propertyOwners.id, existing[0].id));
        return existing[0].id;
      }
    }

    const inserted = await db
      .insert(propertyOwners)
      .values({
        organizationId,
        name: input.name,
        ownerType: input.ownerType ?? "unknown",
        phone: input.phone ?? null,
        email: input.email ?? null,
        mailingAddress: input.mailingAddress ?? null,
        mailingDiffersFromProperty: input.mailingDiffersFromProperty ?? null,
        ownerOccupied: input.ownerOccupied ?? null,
        motivationNotes: input.motivationNotes ?? null,
        leadSource: input.leadSource ?? "manual",
        rentcastPropertyId: input.rentcastPropertyId ?? null,
      })
      .returning({ id: propertyOwners.id });

    return inserted[0].id;
  } catch {
    console.warn("[repository] upsertPropertyOwner failed");
    return null;
  }
}

export async function updateLeadOwner(
  organizationId: string,
  leadId: string,
  ownerId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const ownerRows = await db.select({ id: propertyOwners.id })
      .from(propertyOwners)
      .where(and(eq(propertyOwners.id, ownerId), eq(propertyOwners.organizationId, organizationId)))
      .limit(1);
    if (ownerRows.length === 0) return false;

    await db.update(propertyLeads)
      .set({ ownerId, updatedAt: new Date() })
      .where(and(eq(propertyLeads.id, leadId), eq(propertyLeads.organizationId, organizationId)));
    return true;
  } catch {
    console.warn("[repository] updateLeadOwner failed");
    return false;
  }
}

export async function updateLeadStage(
  organizationId: string,
  leadId: string,
  stage: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.update(propertyLeads)
      .set({ acquisitionStage: stage, updatedAt: new Date() })
      .where(and(eq(propertyLeads.id, leadId), eq(propertyLeads.organizationId, organizationId)));
    return true;
  } catch {
    console.warn("[repository] updateLeadStage failed");
    return false;
  }
}

export async function updateLeadOpportunity(
  organizationId: string,
  leadId: string,
  score: number,
  signals: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db.update(propertyLeads)
      .set({ opportunityScore: score, opportunitySignals: signals, updatedAt: new Date() })
      .where(and(eq(propertyLeads.id, leadId), eq(propertyLeads.organizationId, organizationId)));
    return true;
  } catch {
    console.warn("[repository] updateLeadOpportunity failed");
    return false;
  }
}

export async function listProjectLeads(
  organizationId: string,
  projectId: string
): Promise<PropertyLeadView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(propertyLeads)
      .where(and(
        eq(propertyLeads.organizationId, organizationId),
        eq(propertyLeads.projectId, projectId)
      ))
      .orderBy(desc(propertyLeads.createdAt));

    return rows.map((r) => ({
      id: r.id,
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
      qualificationReason: r.qualificationReason,
      followUpDate: r.followUpDate,
      notes: r.notes,
      ownerId: r.ownerId,
      projectId: r.projectId ?? null,
      opportunityScore: r.opportunityScore ?? null,
      opportunitySignals: r.opportunitySignals ?? null,
    }));
  } catch {
    console.warn("[repository] listProjectLeads failed");
    return null;
  }
}

// ─── Project ownership verification ──────────────────────────────────────────

/**
 * Returns true if the project belongs to the organization.
 * Use this to verify projectId from client input before using it in queries.
 */
export async function projectBelongsToOrg(
  projectId: string,
  organizationId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organizationId)
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Property Search Drafts ───────────────────────────────────────────────────

/**
 * Gets the user's saved property search draft for a specific project.
 * projectId MUST be a valid project ID belonging to organizationId.
 * organizationId and userId MUST come from requireOrganization().
 */
export async function getPropertySearchDraft(
  organizationId: string,
  userId: string,
  projectId: string
): Promise<PropertySearchDraftView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        projectId: propertySearchDrafts.projectId,
        city: propertySearchDrafts.city,
        state: propertySearchDrafts.state,
        zipCode: propertySearchDrafts.zipCode,
        propertyType: propertySearchDrafts.propertyType,
        minBedrooms: propertySearchDrafts.minBedrooms,
        minBathrooms: propertySearchDrafts.minBathrooms,
        maxRent: propertySearchDrafts.maxRent,
        maxDaysListed: propertySearchDrafts.maxDaysListed,
        listingStatus: propertySearchDrafts.listingStatus,
        submitted: propertySearchDrafts.submitted,
        lastSearchAt: propertySearchDrafts.lastSearchAt,
        resultsSnapshot: propertySearchDrafts.resultsSnapshot,
        resultsCount: propertySearchDrafts.resultsCount,
        queryFingerprint: propertySearchDrafts.queryFingerprint,
        mapLatitude: propertySearchDrafts.mapLatitude,
        mapLongitude: propertySearchDrafts.mapLongitude,
        mapRadiusMi: propertySearchDrafts.mapRadiusMi,
        mapMode: propertySearchDrafts.mapMode,
      })
      .from(propertySearchDrafts)
      .where(
        and(
          eq(propertySearchDrafts.organizationId, organizationId),
          eq(propertySearchDrafts.userId, userId),
          eq(propertySearchDrafts.projectId, projectId)
        )
      )
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      projectId: r.projectId,
      city: r.city,
      state: r.state,
      zipCode: r.zipCode,
      propertyType: r.propertyType,
      minBedrooms: r.minBedrooms,
      minBathrooms: r.minBathrooms,
      maxRent: r.maxRent,
      maxDaysListed: r.maxDaysListed,
      listingStatus: r.listingStatus,
      submitted: r.submitted,
      lastSearchAt: r.lastSearchAt,
      resultsSnapshot: r.resultsSnapshot,
      resultsCount: r.resultsCount,
      queryFingerprint: r.queryFingerprint,
      mapLatitude: r.mapLatitude ?? null,
      mapLongitude: r.mapLongitude ?? null,
      mapRadiusMi: r.mapRadiusMi ?? null,
      mapMode: r.mapMode ?? "list",
    };
  } catch {
    console.warn("[repository] getPropertySearchDraft failed");
    return null;
  }
}

/**
 * Upserts the user's property search draft for a specific project.
 * organizationId and userId MUST come from requireOrganization().
 * draft.projectId MUST be verified as belonging to organizationId.
 */
export async function upsertPropertySearchDraft(
  organizationId: string,
  userId: string,
  draft: PropertySearchDraftView
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db
      .insert(propertySearchDrafts)
      .values({
        organizationId,
        userId,
        projectId: draft.projectId,
        city: draft.city,
        state: draft.state,
        zipCode: draft.zipCode,
        propertyType: draft.propertyType,
        minBedrooms: draft.minBedrooms,
        minBathrooms: draft.minBathrooms,
        maxRent: draft.maxRent,
        maxDaysListed: draft.maxDaysListed,
        listingStatus: draft.listingStatus,
        submitted: draft.submitted,
        lastSearchAt: draft.lastSearchAt ?? null,
        resultsSnapshot: draft.resultsSnapshot ?? null,
        resultsCount: draft.resultsCount,
        queryFingerprint: draft.queryFingerprint ?? null,
        mapLatitude: draft.mapLatitude ?? null,
        mapLongitude: draft.mapLongitude ?? null,
        mapRadiusMi: draft.mapRadiusMi ?? null,
        mapMode: draft.mapMode ?? "list",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        // Unique index covers (organizationId, userId, projectId).
        target: [
          propertySearchDrafts.organizationId,
          propertySearchDrafts.userId,
          propertySearchDrafts.projectId,
        ],
        set: {
          city: draft.city,
          state: draft.state,
          zipCode: draft.zipCode,
          propertyType: draft.propertyType,
          minBedrooms: draft.minBedrooms,
          minBathrooms: draft.minBathrooms,
          maxRent: draft.maxRent,
          maxDaysListed: draft.maxDaysListed,
          listingStatus: draft.listingStatus,
          submitted: draft.submitted,
          lastSearchAt: draft.lastSearchAt ?? null,
          resultsSnapshot: draft.resultsSnapshot ?? null,
          resultsCount: draft.resultsCount,
          queryFingerprint: draft.queryFingerprint ?? null,
          mapLatitude: draft.mapLatitude ?? null,
          mapLongitude: draft.mapLongitude ?? null,
          mapRadiusMi: draft.mapRadiusMi ?? null,
          mapMode: draft.mapMode ?? "list",
          updatedAt: new Date(),
        },
      });
    return true;
  } catch {
    console.warn("[repository] upsertPropertySearchDraft failed");
    return false;
  }
}

/**
 * Deletes the user's property search draft for a specific project.
 * organizationId and userId MUST come from requireOrganization().
 * projectId MUST be a valid project ID belonging to organizationId.
 */
export async function deletePropertySearchDraft(
  organizationId: string,
  userId: string,
  projectId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db
      .delete(propertySearchDrafts)
      .where(
        and(
          eq(propertySearchDrafts.organizationId, organizationId),
          eq(propertySearchDrafts.userId, userId),
          eq(propertySearchDrafts.projectId, projectId)
        )
      );
    return true;
  } catch {
    console.warn("[repository] deletePropertySearchDraft failed");
    return false;
  }
}

// ─── Platform Settings (Back Office) ─────────────────────────────────────────

/**
 * Gets a platform-level setting by key.
 * Caller MUST have verified requirePlatformOwner() before calling.
 */
export async function getPlatformSetting(
  key: string
): Promise<PlatformSettingView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.settingKey, key))
      .limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      settingKey: r.settingKey,
      value: r.value,
      enabled: r.enabled,
      updatedByClerkUserId: r.updatedByClerkUserId,
      updatedAt: r.updatedAt,
    };
  } catch {
    console.warn("[repository] getPlatformSetting failed");
    return null;
  }
}

/**
 * Upserts a platform-level setting.
 * Caller MUST have verified requirePlatformOwner() before calling.
 */
export async function upsertPlatformSetting(
  key: string,
  value: string | null,
  enabled: boolean,
  actorClerkUserId: string
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db
      .insert(platformSettings)
      .values({
        settingKey: key,
        value,
        enabled,
        updatedByClerkUserId: actorClerkUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [platformSettings.settingKey],
        set: {
          value,
          enabled,
          updatedByClerkUserId: actorClerkUserId,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch {
    console.warn("[repository] upsertPlatformSetting failed");
    return false;
  }
}

// ─── Audit Log (Back Office) ──────────────────────────────────────────────────

export async function writeAuditLog(entry: {
  actorClerkUserId: string | null;
  actorEmail?: string | null;
  eventType: string;
  detail?: string | null;
  organizationId?: string | null;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(auditLog).values({
      actorClerkUserId: entry.actorClerkUserId,
      actorEmail: entry.actorEmail ?? null,
      eventType: entry.eventType,
      detail: entry.detail ?? null,
      organizationId: entry.organizationId ?? null,
    });
  } catch {
    // Audit log failure is non-fatal — log only
    console.warn("[repository] writeAuditLog failed");
  }
}

export async function listAuditLog(
  limit = 100
): Promise<AuditLogView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      actorClerkUserId: r.actorClerkUserId,
      actorEmail: r.actorEmail,
      eventType: r.eventType,
      detail: r.detail,
      organizationId: r.organizationId,
      createdAt: r.createdAt,
    }));
  } catch {
    console.warn("[repository] listAuditLog failed");
    return null;
  }
}

// ─── Market Research ──────────────────────────────────────────────────────────

export interface MarketResearchView {
  id: string;
  projectId: string;
  targetPopulationSize: string | null;
  referralOrgs: string | null;
  expectedResidentsPerMonth: string | null;
  demandEvidenceNotes: string | null;
  demandRating: string | null;
  fundingSource: string | null;
  expectedPaymentPerResident: string | null;
  expectedResidentContribution: string | null;
  expectedOccupancy: string | null;
  estimatedMonthlyRevenue: string | null;
  fundingNotes: string | null;
  targetPropertyType: string | null;
  propertyTypePreferences: Record<string, "preferred" | "acceptable" | "excluded"> | null;
  minimumBedrooms: string | null;
  maxAcceptableLease: string | null;
  estimatedUtilities: string | null;
  estimatedFurnishingCost: string | null;
  expectedPrivateRoomCapacity: string | null;
  estimatedRentalInventory: string | null;
  typicalLocalRent: string | null;
  avgDaysListed: string | null;
  tiredOwnerIndicators: string | null;
  landlordOutreachNotes: string | null;
  supplySourceLinks: string | null;
  transportationAccess: string | null;
  vaMedicalServices: string | null;
  groceryEssentialServices: string | null;
  referralPartnerProximity: string | null;
  zoningConcerns: string | null;
  neighborhoodConcerns: string | null;
  locationNotes: string | null;
  riskFundingUncertainty: boolean;
  riskInsufficientSupply: boolean;
  riskRentTooHigh: boolean;
  riskRegulatoryIssue: boolean;
  riskWeakReferralPipeline: boolean;
  riskOther: boolean;
  riskMitigationNotes: string | null;
  holdReason: string | null;
  otherMonthlyCosts: string | null;
  decisionStatus: string | null;
  updatedAt: Date;
}

export async function getMarketResearch(
  projectId: string,
  organizationId: string
): Promise<MarketResearchView | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(projectMarketResearch)
      .where(
        and(
          eq(projectMarketResearch.projectId, projectId),
          eq(projectMarketResearch.organizationId, organizationId)
        )
      )
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      projectId: r.projectId,
      targetPopulationSize: r.targetPopulationSize,
      referralOrgs: r.referralOrgs,
      expectedResidentsPerMonth: r.expectedResidentsPerMonth,
      demandEvidenceNotes: r.demandEvidenceNotes,
      demandRating: r.demandRating,
      fundingSource: r.fundingSource,
      expectedPaymentPerResident: r.expectedPaymentPerResident,
      expectedResidentContribution: r.expectedResidentContribution,
      expectedOccupancy: r.expectedOccupancy,
      estimatedMonthlyRevenue: r.estimatedMonthlyRevenue,
      fundingNotes: r.fundingNotes,
      targetPropertyType: r.targetPropertyType,
      propertyTypePreferences: (r.propertyTypePreferences as Record<string, "preferred" | "acceptable" | "excluded"> | null) ?? null,
      minimumBedrooms: r.minimumBedrooms,
      maxAcceptableLease: r.maxAcceptableLease,
      estimatedUtilities: r.estimatedUtilities,
      estimatedFurnishingCost: r.estimatedFurnishingCost,
      expectedPrivateRoomCapacity: r.expectedPrivateRoomCapacity,
      estimatedRentalInventory: r.estimatedRentalInventory,
      typicalLocalRent: r.typicalLocalRent,
      avgDaysListed: r.avgDaysListed,
      tiredOwnerIndicators: r.tiredOwnerIndicators,
      landlordOutreachNotes: r.landlordOutreachNotes,
      supplySourceLinks: r.supplySourceLinks,
      transportationAccess: r.transportationAccess,
      vaMedicalServices: r.vaMedicalServices,
      groceryEssentialServices: r.groceryEssentialServices,
      referralPartnerProximity: r.referralPartnerProximity,
      zoningConcerns: r.zoningConcerns,
      neighborhoodConcerns: r.neighborhoodConcerns,
      locationNotes: r.locationNotes,
      riskFundingUncertainty: r.riskFundingUncertainty,
      riskInsufficientSupply: r.riskInsufficientSupply,
      riskRentTooHigh: r.riskRentTooHigh,
      riskRegulatoryIssue: r.riskRegulatoryIssue,
      riskWeakReferralPipeline: r.riskWeakReferralPipeline,
      riskOther: r.riskOther,
      riskMitigationNotes: r.riskMitigationNotes,
      holdReason: r.holdReason,
      otherMonthlyCosts: r.otherMonthlyCosts,
      decisionStatus: r.decisionStatus,
      updatedAt: r.updatedAt,
    };
  } catch {
    console.warn("[repository] getMarketResearch failed");
    return null;
  }
}

export async function upsertMarketResearch(
  projectId: string,
  organizationId: string,
  data: Partial<Omit<MarketResearchView, "id" | "projectId" | "updatedAt">>
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    await db
      .insert(projectMarketResearch)
      .values({
        projectId,
        organizationId,
        ...data,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: projectMarketResearch.projectId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      });
    return true;
  } catch {
    console.warn("[repository] upsertMarketResearch failed");
    return false;
  }
}
