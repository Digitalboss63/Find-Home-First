import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import type { DrizzleDb } from "@/db/client";
import {
  contacts,
  projectStatusHistory,
  projects,
  properties,
  residents,
  tasks,
} from "@/db/schema";
import { PREPARATION_TASKS } from "@/lib/repository-leads";

export interface PlacementPropertyView {
  id: string;
  leadId: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  monthlyRent: string | null;
  readinessStatus: string;
  agreementType: string | null;
  agreementSignedDate: string | null;
  availableDate: string | null;
}

export interface PlacementResidentView {
  id: string;
  displayName: string;
  householdSize: number;
  bedroomsNeeded: number;
  accessibilityNeeds: string | null;
  incomeRange: string | null;
  notes: string | null;
  placementStatus: string;
  referralContactId: string | null;
  referralContactName: string | null;
}

export interface PlacementContactView {
  id: string;
  name: string;
  organizationName: string | null;
}

export interface PlacementTaskView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
}

export interface PlacementHistoryView {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  reason: string | null;
  changedAt: string;
}

export interface PlacementWorkspaceView {
  project: {
    id: string;
    name: string;
    community: string;
    currentStatus: string;
    targetMoveIn: string | null;
    residentId: string | null;
    propertyId: string | null;
  };
  property: PlacementPropertyView | null;
  matchedResident: PlacementResidentView | null;
  residents: PlacementResidentView[];
  contacts: PlacementContactView[];
  preparationTasks: PlacementTaskView[];
  history: PlacementHistoryView[];
}

export async function getPlacementWorkspace(
  db: DrizzleDb,
  organizationId: string,
  projectId: string,
): Promise<PlacementWorkspaceView | null> {
  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      community: projects.community,
      currentStatus: projects.currentStatus,
      targetMoveIn: projects.targetMoveIn,
      residentId: projects.residentId,
      propertyId: projects.propertyId,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ),
    )
    .limit(1);
  const project = projectRows[0];
  if (!project) return null;

  const [propertyRows, residentRows, contactRows, taskRows, historyRows] =
    await Promise.all([
      project.propertyId
        ? db
            .select({
              id: properties.id,
              leadId: properties.leadId,
              address: properties.address,
              city: properties.city,
              state: properties.state,
              zip: properties.zip,
              propertyType: properties.propertyType,
              bedrooms: properties.bedrooms,
              bathrooms: properties.bathrooms,
              monthlyRent: properties.monthlyRent,
              readinessStatus: properties.readinessStatus,
              agreementType: properties.agreementType,
              agreementSignedDate: properties.agreementSignedDate,
              availableDate: properties.availableDate,
            })
            .from(properties)
            .where(
              and(
                eq(properties.id, project.propertyId),
                eq(properties.organizationId, organizationId),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
      db
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
          referralContactName: contacts.name,
        })
        .from(residents)
        .leftJoin(contacts, eq(residents.referralContactId, contacts.id))
        .where(eq(residents.organizationId, organizationId))
        .orderBy(asc(residents.displayName)),
      db
        .select({
          id: contacts.id,
          name: contacts.name,
          organizationName: contacts.organizationName,
        })
        .from(contacts)
        .where(
          and(
            eq(contacts.organizationId, organizationId),
            eq(contacts.contactType, "referral"),
          ),
        )
        .orderBy(asc(contacts.name)),
      db
        .select({
          id: tasks.id,
          leadId: tasks.leadId,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            eq(tasks.projectId, projectId),
          ),
        )
        .orderBy(asc(tasks.createdAt)),
      db
        .select({
          id: projectStatusHistory.id,
          previousStatus: projectStatusHistory.previousStatus,
          newStatus: projectStatusHistory.newStatus,
          reason: projectStatusHistory.reason,
          changedAt: projectStatusHistory.changedAt,
        })
        .from(projectStatusHistory)
        .where(eq(projectStatusHistory.projectId, projectId))
        .orderBy(desc(projectStatusHistory.changedAt)),
    ]);

  const property = propertyRows[0] ?? null;
  const preparationTasks = property?.leadId
    ? taskRows.filter(
        (task) =>
          task.leadId === property.leadId &&
          (PREPARATION_TASKS as readonly string[]).includes(task.title),
      )
    : [];
  const matchedResident =
    residentRows.find((resident) => resident.id === project.residentId) ?? null;

  return {
    project,
    property,
    matchedResident,
    residents: residentRows,
    contacts: contactRows,
    preparationTasks: preparationTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
    })),
    history: historyRows.map((entry) => ({
      ...entry,
      changedAt: entry.changedAt.toISOString(),
    })),
  };
}
