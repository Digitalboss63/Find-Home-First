/**
 * Drizzle ORM schema — Find Home First
 *
 * Server-only. Never import this file in browser/client code.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  index,
} from "drizzle-orm/pg-core";

// ─── Organizations ──────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Contacts ───────────────────────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** "referral" | "landlord" | "owner" | "staff" | "other" */
    contactType: text("contact_type").notNull().default("referral"),
    name: text("name").notNull(),
    organizationName: text("organization_name"),
    roleTitle: text("role_title"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("contacts_org_idx").on(t.organizationId),
    index("contacts_type_idx").on(t.contactType),
  ]
);

// ─── Residents ──────────────────────────────────────────────────────────────

export const residents = pgTable(
  "residents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    referralContactId: uuid("referral_contact_id").references(
      () => contacts.id,
      { onDelete: "set null" }
    ),
    householdSize: integer("household_size").notNull().default(1),
    bedroomsNeeded: integer("bedrooms_needed").notNull().default(0),
    accessibilityNeeds: text("accessibility_needs"),
    incomeRange: text("income_range"),
    notes: text("notes"),
    /** "pending" | "active" | "placed" | "inactive" */
    placementStatus: text("placement_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("residents_org_idx").on(t.organizationId),
    index("residents_status_idx").on(t.placementStatus),
  ]
);

// ─── Property candidates (listing search results) ────────────────────────────

export const propertyCandidates = pgTable(
  "property_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("manual"),
    externalListingId: text("external_listing_id"),
    sourceUrl: text("source_url"),
    address: text("address").notNull(),
    community: text("community"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
    monthlyRent: numeric("monthly_rent", { precision: 10, scale: 2 }),
    availableDate: date("available_date"),
    /** "active" | "unavailable" | "pending_review" | "archived" */
    listingStatus: text("listing_status").notNull().default("active"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("prop_candidates_org_idx").on(t.organizationId),
    index("prop_candidates_status_idx").on(t.listingStatus),
    index("prop_candidates_community_idx").on(t.community),
  ]
);

// ─── Properties (secured/leased units) ──────────────────────────────────────

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id").references(() => propertyCandidates.id, {
      onDelete: "set null",
    }),
    ownerContactId: uuid("owner_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    address: text("address").notNull(),
    community: text("community"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
    monthlyRent: numeric("monthly_rent", { precision: 10, scale: 2 }),
    availableDate: date("available_date"),
    /** "available" | "preparing" | "occupied" | "unavailable" */
    readinessStatus: text("readiness_status").notNull().default("available"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("properties_org_idx").on(t.organizationId),
    index("properties_status_idx").on(t.readinessStatus),
  ]
);

// ─── Projects ────────────────────────────────────────────────────────────────

/**
 * The 13 workflow statuses — source of truth.
 * Visible stage is DERIVED from this value (see statusToStage in lib/stages.ts).
 */
export const PROJECT_STATUSES = [
  "researching_city",
  "city_approved",
  "finding_property",
  "contacting_owner",
  "application_in_progress",
  "property_approved",
  "preparing_property",
  "seeking_referrals",
  "reviewing_resident",
  "placement_approved",
  "move_in_scheduled",
  "moved_in",
  "closed_not_proceeding",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    community: text("community").notNull(),
    residentId: uuid("resident_id").references(() => residents.id, {
      onDelete: "set null",
    }),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "set null",
    }),
    currentStatus: text("current_status").notNull().default("researching_city"),
    targetMoveIn: date("target_move_in"),
    blocker: text("blocker"),
    blockerReason: text("blocker_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("projects_org_idx").on(t.organizationId),
    index("projects_status_idx").on(t.currentStatus),
    index("projects_resident_idx").on(t.residentId),
  ]
);

// ─── Project status history ──────────────────────────────────────────────────

export const projectStatusHistory = pgTable(
  "project_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    reason: text("reason"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("status_history_project_idx").on(t.projectId)]
);

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    /** "today" | "upcoming" | "completed" */
    status: text("status").notNull().default("upcoming"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("tasks_org_idx").on(t.organizationId),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_status_idx").on(t.status),
    index("tasks_due_idx").on(t.dueDate),
  ]
);

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_clerk_idx").on(t.clerkUserId)]
);

// ─── Organization Memberships ─────────────────────────────────────────────────

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "owner" | "staff" */
    role: text("role").notNull().default("staff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("memberships_org_idx").on(t.organizationId),
    index("memberships_user_idx").on(t.userId),
  ]
);
