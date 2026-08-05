/**
 * Drizzle ORM schema — Find Home First
 *
 * Server-only. Never import this file in browser/client code.
 *
 * Canonical model:
 * - Housing operators find motivated property owners and lease properties.
 * - Property leads track the owner-outreach acquisition pipeline.
 * - Placement projects track individual residents through move-in.
 * - Back-office settings (ADA widget, platform config) are platform-level, not org-level.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
  boolean,
  index,
  uniqueIndex,
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

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email"),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("memberships_org_idx").on(t.organizationId),
    index("memberships_user_idx").on(t.userId),
  ]
);

// ─── Contacts — referral partners, caseworkers ───────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** "referral" | "staff" | "other" */
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

// ─── Property Owners ─────────────────────────────────────────────────────────
//
// Owners are the primary lead target. Separate from referral contacts.
// One owner may own multiple properties.

export const propertyOwners = pgTable(
  "property_owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** "individual" | "organization" | "unknown" */
    ownerType: text("owner_type").notNull().default("unknown"),
    phone: text("phone"),
    email: text("email"),
    mailingAddress: text("mailing_address"),
    /** True when mailing address differs from any linked property address. */
    mailingDiffersFromProperty: boolean("mailing_differs_from_property"),
    /** True when owner-occupied (may indicate less motivation). */
    ownerOccupied: boolean("owner_occupied"),
    /** Freeform motivation notes — e.g. "extended listing age", "non-owner-occupied". */
    motivationNotes: text("motivation_notes"),
    /** "new" | "researching" | "outreach" | "follow_up" | "meeting" | "negotiating" | "contracted" | "inactive" */
    outreachStatus: text("outreach_status").notNull().default("new"),
    lastContactDate: date("last_contact_date"),
    nextFollowUpDate: date("next_follow_up_date"),
    lastResponse: text("last_response"),
    /** How this lead was found — "rentcast" | "zillow" | "manual" | "referral" | "other" */
    leadSource: text("lead_source").notNull().default("manual"),
    rentcastPropertyId: text("rentcast_property_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("owners_org_idx").on(t.organizationId),
    index("owners_status_idx").on(t.outreachStatus),
    index("owners_rentcast_idx").on(t.rentcastPropertyId),
  ]
);

// ─── Property Leads ───────────────────────────────────────────────────────────
//
// One property being evaluated for leasing. Linked to an owner.
// Replaces the old property_candidates (listing-aggregator model).
// Acquisition pipeline stage lives here.

export const ACQUISITION_STAGES = [
  "lead_identified",
  "owner_research",
  "outreach",
  "follow_up",
  "meeting_scheduled",
  "application_requested",
  "application_submitted",
  "approved",
  "rejected",
  "lease_executed",
  "property_preparation",
  "ready_for_referrals",
] as const;

export type AcquisitionStage = (typeof ACQUISITION_STAGES)[number];

export const propertyLeads = pgTable(
  "property_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => propertyOwners.id, {
      onDelete: "set null",
    }),
    // FK to projects enforced in migration 0005 (not here to avoid circular type inference)
    projectId: uuid("project_id"),
    opportunityScore: integer("opportunity_score"),
    opportunitySignals: text("opportunity_signals"),
    /** "rentcast" | "zillow" | "manual" | "other" */
    source: text("source").notNull().default("manual"),
    /** External listing/property ID from source API. */
    externalId: text("external_id"),
    sourceUrl: text("source_url"),
    /** Normalized address for dedup (lowercase, alphanumeric+space). */
    normalizedAddress: text("normalized_address"),
    /** Normalized source URL for dedup (hostname+pathname, lowercase). */
    normalizedSourceUrl: text("normalized_source_url"),
    address: text("address").notNull(),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    /** "single_family" | "multi_family" | "condo" | "townhouse" | "apartment" | "sro" | "other" */
    propertyType: text("property_type"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
    monthlyRent: numeric("monthly_rent", { precision: 10, scale: 2 }),
    deposit: numeric("deposit", { precision: 10, scale: 2 }),
    /** "utilities_included" | "utilities_excluded" | "partial" | "unknown" */
    utilitiesStatus: text("utilities_status"),
    /** "excellent" | "good" | "fair" | "poor" | "unknown" */
    propertyCondition: text("property_condition"),
    /** "vacant" | "occupied" | "unknown" */
    occupancyStatus: text("occupancy_status").default("unknown"),
    /** "active" | "inactive" | "archived" */
    listingStatus: text("listing_status").notNull().default("active"),
    listingDate: date("listing_date"),
    lastSeenDate: date("last_seen_date"),
    daysOnMarket: integer("days_on_market"),
    listingContact: text("listing_contact"),
    listingPhone: text("listing_phone"),
    listingEmail: text("listing_email"),
    /** Current stage in the acquisition pipeline. */
    acquisitionStage: text("acquisition_stage")
      .notNull()
      .default("lead_identified"),
    /** "pending" | "suitable" | "not_suitable" | "deferred" */
    qualificationStatus: text("qualification_status")
      .notNull()
      .default("pending"),
    qualificationReason: text("qualification_reason"),
    /** Free-form suitability notes for private resident spaces. */
    suitabilityNotes: text("suitability_notes"),
    followUpDate: date("follow_up_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("leads_org_idx").on(t.organizationId),
    index("leads_stage_idx").on(t.acquisitionStage),
    index("leads_owner_idx").on(t.ownerId),
    index("leads_external_idx").on(t.externalId),
    // Project-scoped dedup indexes
    index("leads_project_idx").on(t.projectId),
    index("leads_proj_external_idx").on(t.organizationId, t.projectId, t.externalId),
    index("leads_proj_norm_url_idx").on(t.organizationId, t.projectId, t.normalizedSourceUrl),
    index("leads_proj_norm_address_idx").on(t.organizationId, t.projectId, t.normalizedAddress),
  ]
);

// ─── Property Search Drafts ───────────────────────────────────────────────────
//
// Persists a user's RentCast search criteria and submitted state.
// One row per user per org. Restored on return so work is never lost.

export const propertySearchDrafts = pgTable(
  "property_search_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * Required project scope. This draft belongs to a specific placement
     * project. organizationId ownership of the project is verified on every write.
     */
    projectId: uuid("project_id").notNull().references(() => projects.id, {
      onDelete: "cascade",
    }),
    // Search criteria
    city: text("city").notNull().default(""),
    state: text("state").notNull().default(""),
    zipCode: text("zip_code").notNull().default(""),
    propertyType: text("property_type").notNull().default(""),
    minBedrooms: text("min_bedrooms").notNull().default(""),
    minBathrooms: text("min_bathrooms").notNull().default(""),
    maxRent: text("max_rent").notNull().default(""),
    maxDaysListed: text("max_days_listed").notNull().default(""),
    /** "active" | "inactive" | "" (any) */
    listingStatus: text("listing_status").notNull().default("active"),
    // Execution state
    /** True when user has pressed "Search Properties" at least once. */
    submitted: boolean("submitted").notNull().default(false),
    lastSearchAt: timestamp("last_search_at", { withTimezone: true }),
    /**
     * Normalized JSON snapshot of the last RentCast result set.
     * Allows restoring results on return without re-calling the API.
     * Stored as a JSON string; never contains raw API credentials.
     */
    resultsSnapshot: text("results_snapshot"),
    /** Count of results in the snapshot (for display before parsing). */
    resultsCount: integer("results_count").notNull().default(0),
    /**
     * Fingerprint of the search parameters that produced the snapshot.
     * Used to detect stale results when criteria change.
     */
    queryFingerprint: text("query_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One draft per (org, user, project). NULL projectId uses COALESCE sentinel
    // in the SQL migration unique index; Drizzle sees it as a composite.
    index("search_drafts_org_user_idx").on(t.organizationId, t.userId),
    index("search_drafts_project_idx").on(t.projectId),
  ]
);

// ─── Properties (secured / leased units) ─────────────────────────────────────
//
// A property that has completed the acquisition pipeline and been secured
// through a lease or operating agreement. Ready for resident placement.

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => propertyLeads.id, {
      onDelete: "set null",
    }),
    ownerId: uuid("owner_id").references(() => propertyOwners.id, {
      onDelete: "set null",
    }),
    address: text("address").notNull(),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    propertyType: text("property_type"),
    bedrooms: integer("bedrooms"),
    bathrooms: numeric("bathrooms", { precision: 3, scale: 1 }),
    monthlyRent: numeric("monthly_rent", { precision: 10, scale: 2 }),
    deposit: numeric("deposit", { precision: 10, scale: 2 }),
    utilitiesStatus: text("utilities_status"),
    /** "lease" | "operating_agreement" | "other" */
    agreementType: text("agreement_type"),
    leaseStartDate: date("lease_start_date"),
    leaseEndDate: date("lease_end_date"),
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

// ─── Residents ───────────────────────────────────────────────────────────────

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

// ─── Projects (placement cases) ───────────────────────────────────────────────
//
// One project = one resident or household placement case.
// Tracks the resident through the placement workflow.
// The 13 workflow statuses remain authoritative.

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
    currentStatus: text("current_status")
      .notNull()
      .default("researching_city"),
    targetMoveIn: date("target_move_in"),
    blocker: text("blocker"),
    blockerReason: text("blocker_reason"),
    /** What the case worker should do next. */
    nextAction: text("next_action"),
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

// ─── Project Status History ───────────────────────────────────────────────────

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

// ─── Back Office — Platform Settings ─────────────────────────────────────────
//
// Platform-level settings, not org-level. Managed by the platform owner only.

export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Unique key for each setting — e.g. "ada_widget" */
  settingKey: text("setting_key").notNull().unique(),
  value: text("value"),
  enabled: boolean("enabled").notNull().default(false),
  updatedByClerkUserId: text("updated_by_clerk_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Audit Log ───────────────────────────────────────────────────────────────
//
// Platform-level event log. Used by Back Office audit view.

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk user ID of the actor. */
    actorClerkUserId: text("actor_clerk_user_id"),
    actorEmail: text("actor_email"),
    /** e.g. "ada_widget.enabled", "ada_widget.updated", "org.created" */
    eventType: text("event_type").notNull(),
    /** Free-form detail payload (JSON string or text). */
    detail: text("detail"),
    organizationId: uuid("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorClerkUserId),
    index("audit_log_event_idx").on(t.eventType),
    index("audit_log_org_idx").on(t.organizationId),
    index("audit_log_created_idx").on(t.createdAt),
  ]
);

// ─── Market Research ──────────────────────────────────────────────────────────

export const projectMarketResearch = pgTable(
  "project_market_research",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    // Section 2: Housing Demand
    targetPopulationSize: text("target_population_size"),
    referralOrgs: text("referral_orgs"),
    expectedResidentsPerMonth: text("expected_residents_per_month"),
    demandEvidenceNotes: text("demand_evidence_notes"),
    demandRating: text("demand_rating"),

    // Section 3: Funding & Revenue
    fundingSource: text("funding_source"),
    expectedPaymentPerResident: text("expected_payment_per_resident"),
    expectedResidentContribution: text("expected_resident_contribution"),
    expectedOccupancy: text("expected_occupancy"),
    estimatedMonthlyRevenue: text("estimated_monthly_revenue"),
    fundingNotes: text("funding_notes"),

    // Section 4: Property Economics
    targetPropertyType: text("target_property_type"),
    minimumBedrooms: text("minimum_bedrooms"),
    maxAcceptableLease: text("max_acceptable_lease"),
    estimatedUtilities: text("estimated_utilities"),
    estimatedFurnishingCost: text("estimated_furnishing_cost"),
    expectedPrivateRoomCapacity: text("expected_private_room_capacity"),

    // Section 5: Property Supply
    estimatedRentalInventory: text("estimated_rental_inventory"),
    typicalLocalRent: text("typical_local_rent"),
    avgDaysListed: text("avg_days_listed"),
    tiredOwnerIndicators: text("tired_owner_indicators"),
    landlordOutreachNotes: text("landlord_outreach_notes"),
    supplySourceLinks: text("supply_source_links"),

    // Section 6: Location Suitability
    transportationAccess: text("transportation_access"),
    vaMedicalServices: text("va_medical_services"),
    groceryEssentialServices: text("grocery_essential_services"),
    referralPartnerProximity: text("referral_partner_proximity"),
    zoningConcerns: text("zoning_concerns"),
    neighborhoodConcerns: text("neighborhood_concerns"),
    locationNotes: text("location_notes"),

    // Section 7: Risks & Blockers
    riskFundingUncertainty: boolean("risk_funding_uncertainty").notNull().default(false),
    riskInsufficientSupply: boolean("risk_insufficient_supply").notNull().default(false),
    riskRentTooHigh: boolean("risk_rent_too_high").notNull().default(false),
    riskRegulatoryIssue: boolean("risk_regulatory_issue").notNull().default(false),
    riskWeakReferralPipeline: boolean("risk_weak_referral_pipeline").notNull().default(false),
    riskOther: boolean("risk_other").notNull().default(false),
    riskMitigationNotes: text("risk_mitigation_notes"),

    // Hold state
    holdReason: text("hold_reason"),
    // Additional costs for margin calculation
    otherMonthlyCosts: text("other_monthly_costs"),

    decisionStatus: text("decision_status"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("market_research_project_idx").on(t.projectId),
    index("market_research_org_idx").on(t.organizationId),
  ]
);


// --- Market Intelligence Jobs -------------------------------------------------
//
// Tracks automated data-collection and report-generation runs.
// One job per refresh request. Jobs are org+project scoped.

export const marketResearchJobs = pgTable(
  "market_research_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** "pending" | "running" | "complete" | "failed" */
    status: text("status").notNull().default("pending"),
    /** Clerk userId of the person who triggered the run */
    triggeredBy: text("triggered_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Sanitized error message — never includes credentials */
    errorMessage: text("error_message"),
    /** JSON summary of per-source outcomes: { census: "ok"|"not_verified", ... } */
    sourcesSummary: text("sources_summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mrj_org_idx").on(t.organizationId),
    index("mrj_project_idx").on(t.projectId),
    index("mrj_status_idx").on(t.status),
  ]
);

// --- Market Intelligence Reports (versioned snapshots) ------------------------
//
// Immutable versioned report snapshots. The reportJson field holds a
// complete MarketReportSnapshot serialized as JSON.
// Versions increment per project; status "complete" = current, "superseded" = old.
// Cross-org access is prevented by the organizationId column in every query.

export const marketResearchReports = pgTable(
  "market_research_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => marketResearchJobs.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull(),
    /** "complete" | "superseded" */
    status: text("status").notNull().default("complete"),
    /** Full MarketReportSnapshot as JSON. Never includes credentials or orgId. */
    reportJson: text("report_json").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    /** ISO date string YYYY-MM-DD — latest data date across all sources */
    dataThroughDate: text("data_through_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("mrr_org_idx").on(t.organizationId),
    index("mrr_project_idx").on(t.projectId),
    uniqueIndex("mrr_project_version_idx").on(t.projectId, t.version),
  ]
);
