/**
 * Repository — typed data-access layer.
 *
 * SECURITY: All functions require organizationId from requireOrganization().
 * Never pass organizationId from client input.
 *
 * Demo fallback only in development or DEMO_MODE=true.
 * Production failures return null — callers must redirect /unavailable.
 *
 * Server-only: never import from client components.
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  projects,
  tasks,
  contacts,
  residents,
  propertyCandidates,
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

export interface PropertyCandidateView {
  id: string;
  address: string;
  community: string | null;
  bedrooms: number | null;
  monthlyRent: string | null;
  availableDate: string | null;
  listingStatus: string;
  provider: string;
  sourceUrl: string | null;
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
        residentDisplayName: residents.displayName,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(residents, eq(projects.residentId, residents.id))
      .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
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
      .where(and(eq(tasks.projectId, projectId), eq(tasks.organizationId, organizationId)))
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
      .leftJoin(referralContacts, eq(residents.referralContactId, referralContacts.id))
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

// ─── Property candidates ──────────────────────────────────────────────────────

export async function listPropertyCandidates(
  organizationId: string
): Promise<PropertyCandidateView[] | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        id: propertyCandidates.id,
        address: propertyCandidates.address,
        community: propertyCandidates.community,
        bedrooms: propertyCandidates.bedrooms,
        monthlyRent: propertyCandidates.monthlyRent,
        availableDate: propertyCandidates.availableDate,
        listingStatus: propertyCandidates.listingStatus,
        provider: propertyCandidates.provider,
        sourceUrl: propertyCandidates.sourceUrl,
      })
      .from(propertyCandidates)
      .where(eq(propertyCandidates.organizationId, organizationId))
      .orderBy(propertyCandidates.createdAt);

    return rows.map((r) => ({
      id: r.id,
      address: r.address,
      community: r.community,
      bedrooms: r.bedrooms,
      monthlyRent: r.monthlyRent,
      availableDate: r.availableDate,
      listingStatus: r.listingStatus,
      provider: r.provider,
      sourceUrl: r.sourceUrl,
    }));
  } catch {
    console.warn("[repository] listPropertyCandidates failed");
    return null;
  }
}
