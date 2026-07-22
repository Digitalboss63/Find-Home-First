/**
 * Repository — typed data-access layer.
 *
 * Pages must not call Drizzle directly.
 * All functions return null when the DB is unavailable (caller falls back to demo data).
 *
 * Server-only: never import from client components.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  projects,
  tasks,
  contacts,
  residents,
  propertyCandidates,
} from "@/db/schema";
import { statusToStageKey } from "./stages";

// ─── Shared view types (safe to import anywhere) ──────────────────────────────

export interface ProjectView {
  id: string;
  name: string;
  community: string;
  currentStatus: string;
  /** Derived visible stage key */
  currentStage: string;
  targetMoveIn: string | null;
  blocker: string | null;
  blockerReason: string | null;
  residentName: string | null;
  /** Coarse status for grouping: "active" | "completed" | "closed" */
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
  /** "today" | "upcoming" | "completed" */
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

function deriveGroupStatus(
  currentStatus: string
): "active" | "completed" | "closed" {
  if (currentStatus === "moved_in") return "completed";
  if (currentStatus === "closed_not_proceeding") return "closed";
  return "active";
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectView[] | null> {
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
    console.warn("[find-home-first] listProjects query failed. Falling back to demo data.");
    return null;
  }
}

export async function listActiveProjects(): Promise<ProjectView[] | null> {
  const all = await listProjects();
  if (!all) return null;
  return all.filter((p) => p.groupStatus === "active");
}

export async function getProjectById(
  id: string
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
      .where(eq(projects.id, id))
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
    console.warn("[find-home-first] getProjectById query failed. Falling back to demo data.");
    return null;
  }
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<TaskView[] | null> {
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
    console.warn("[find-home-first] listTasks query failed. Falling back to demo data.");
    return null;
  }
}

export async function listTasksForProject(
  projectId: string
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
      .where(eq(tasks.projectId, projectId))
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
    console.warn("[find-home-first] listTasksForProject query failed. Falling back to demo data.");
    return null;
  }
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function listContacts(): Promise<ContactView[] | null> {
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
      .orderBy(contacts.name);

    return rows;
  } catch {
    console.warn("[find-home-first] listContacts query failed. Falling back to demo data.");
    return null;
  }
}

// ─── Residents ────────────────────────────────────────────────────────────────

export async function listResidents(): Promise<ResidentView[] | null> {
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
      })
      .from(residents)
      .orderBy(residents.displayName);

    return rows;
  } catch {
    console.warn("[find-home-first] listResidents query failed. Falling back to demo data.");
    return null;
  }
}

// ─── Property candidates ──────────────────────────────────────────────────────

export async function listPropertyCandidates(): Promise<
  PropertyCandidateView[] | null
> {
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
    console.warn("[find-home-first] listPropertyCandidates query failed. Falling back to demo data.");
    return null;
  }
}
