/**
 * DEMONSTRATION DATA — Find Home First
 *
 * Purpose: structural and workflow illustration only.
 * All records are fictional. No database or external API is used.
 * Replace entirely with real data models and API calls in future phases.
 *
 * Visual presentation of this data is REPLIT-UI ownership.
 */

// ─── Placement stages ─────────────────────────────────────────────────────────

export type StageKey =
  | "research"
  | "find-housing"
  | "secure-property"
  | "match-resident"
  | "move-in";

export interface Stage {
  key: StageKey;
  label: string;
  description: string;
}

export const STAGES: Stage[] = [
  {
    key: "research",
    label: "Research",
    description:
      "Explore community data, affordability, and neighborhood fit to identify target areas.",
  },
  {
    key: "find-housing",
    label: "Find Housing",
    description:
      "Locate suitable private units from verified sources and manual entries.",
  },
  {
    key: "secure-property",
    label: "Secure Property",
    description:
      "Coordinate landlord outreach, documentation, and agreements to reserve units.",
  },
  {
    key: "match-resident",
    label: "Match Resident",
    description:
      "Align housing options with resident profiles, eligibility, and program requirements.",
  },
  {
    key: "move-in",
    label: "Move In",
    description:
      "Confirm placement, capture move-in documentation, and close the case.",
  },
];

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = "active" | "on-hold" | "completed";

export interface DemoProject {
  id: string;
  name: string;
  community: string;
  currentStage: StageKey;
  status: ProjectStatus;
  residentName: string;
  /** ISO date string */
  targetMoveIn: string;
  /** Present only when the project is blocked. Displayed as a blocker alert. */
  blocker?: string;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: "proj-001",
    name: "Eastside Rapid Rehousing — Unit 4B",
    community: "Eastside",
    currentStage: "secure-property",
    status: "active",
    residentName: "Marcus T.",
    targetMoveIn: "2026-08-15",
    blocker: "Landlord agreement pending signature — follow up by Friday.",
  },
  {
    id: "proj-002",
    name: "Northview Family Placement",
    community: "Northview",
    currentStage: "match-resident",
    status: "active",
    residentName: "Rivera Family",
    targetMoveIn: "2026-08-30",
  },
  {
    id: "proj-003",
    name: "Downtown SRO — Room 12",
    community: "Downtown",
    currentStage: "find-housing",
    status: "active",
    residentName: "Diane W.",
    targetMoveIn: "2026-09-01",
  },
  {
    id: "proj-004",
    name: "Westpark Senior Placement",
    community: "Westpark",
    currentStage: "move-in",
    status: "completed",
    residentName: "Earl J.",
    targetMoveIn: "2026-07-10",
  },
];

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = "today" | "upcoming" | "completed";

export interface DemoTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  /** ISO date string */
  dueDate: string;
  status: TaskStatus;
}

export const DEMO_TASKS: DemoTask[] = [
  {
    id: "task-001",
    title: "Follow up with landlord on lease signature",
    projectId: "proj-001",
    projectName: "Eastside Rapid Rehousing — Unit 4B",
    dueDate: "2026-07-22",
    status: "today",
  },
  {
    id: "task-002",
    title: "Schedule unit walkthrough for Rivera Family",
    projectId: "proj-002",
    projectName: "Northview Family Placement",
    dueDate: "2026-07-22",
    status: "today",
  },
  {
    id: "task-003",
    title: "Submit income verification documents for Diane W.",
    projectId: "proj-003",
    projectName: "Downtown SRO — Room 12",
    dueDate: "2026-07-25",
    status: "upcoming",
  },
  {
    id: "task-004",
    title: "Search available 2BR units near Northview transit corridor",
    projectId: "proj-002",
    projectName: "Northview Family Placement",
    dueDate: "2026-07-28",
    status: "upcoming",
  },
  {
    id: "task-005",
    title: "Collect signed move-in documentation from Earl J.",
    projectId: "proj-004",
    projectName: "Westpark Senior Placement",
    dueDate: "2026-07-10",
    status: "completed",
  },
  {
    id: "task-006",
    title: "Send welcome packet to Westpark property manager",
    projectId: "proj-004",
    projectName: "Westpark Senior Placement",
    dueDate: "2026-07-11",
    status: "completed",
  },
];

// ─── Referral contacts ────────────────────────────────────────────────────────

export interface DemoReferralContact {
  id: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
}

export const DEMO_REFERRAL_CONTACTS: DemoReferralContact[] = [
  {
    id: "ref-001",
    name: "Sandra Okafor",
    organization: "Community Housing Alliance",
    role: "Intake Coordinator",
    email: "s.okafor@cha-demo.org",
    phone: "(404) 555-0182",
    notes: "Primary contact for Eastside referrals. Responds quickly by email.",
  },
  {
    id: "ref-002",
    name: "James Prieto",
    organization: "Northview Family Services",
    role: "Case Manager",
    email: "jpriet@nvfs-demo.org",
    phone: "(404) 555-0247",
    notes: "Handles family placements with 2–4 members.",
  },
  {
    id: "ref-003",
    name: "Linda Marsh",
    organization: "Downtown Shelter Network",
    role: "Director of Housing Transitions",
    email: "l.marsh@dsn-demo.org",
    phone: "(404) 555-0391",
    notes: "Best for SRO and single-adult placements.",
  },
];

// ─── Prospective residents ────────────────────────────────────────────────────

export type ResidentStatus = "pending" | "active" | "placed";

export interface DemoProspectiveResident {
  id: string;
  name: string;
  referredBy: string;
  householdSize: number;
  bedroomsNeeded: number;
  accessibilityNeeds: string;
  incomeRange: string;
  notes: string;
  status: ResidentStatus;
}

export const DEMO_PROSPECTIVE_RESIDENTS: DemoProspectiveResident[] = [
  {
    id: "res-001",
    name: "Marcus T.",
    referredBy: "Sandra Okafor",
    householdSize: 1,
    bedroomsNeeded: 1,
    accessibilityNeeds: "None noted",
    incomeRange: "$1,000–$1,400/mo",
    notes: "Active project underway. Prefers Eastside.",
    status: "active",
  },
  {
    id: "res-002",
    name: "Rivera Family",
    referredBy: "James Prieto",
    householdSize: 4,
    bedroomsNeeded: 2,
    accessibilityNeeds: "Ground-floor or elevator required",
    incomeRange: "$2,200–$2,800/mo",
    notes: "Two children. School district matters — Northview preferred.",
    status: "active",
  },
  {
    id: "res-003",
    name: "Diane W.",
    referredBy: "Linda Marsh",
    householdSize: 1,
    bedroomsNeeded: 0,
    accessibilityNeeds: "None noted",
    incomeRange: "$600–$900/mo",
    notes: "Flexible on location. SRO or studio acceptable.",
    status: "active",
  },
  {
    id: "res-004",
    name: "Earl J.",
    referredBy: "Sandra Okafor",
    householdSize: 1,
    bedroomsNeeded: 1,
    accessibilityNeeds: "Wheelchair accessible",
    incomeRange: "$900–$1,200/mo",
    notes: "Placed — Westpark unit confirmed.",
    status: "placed",
  },
  {
    id: "res-005",
    name: "Patricia B.",
    referredBy: "James Prieto",
    householdSize: 2,
    bedroomsNeeded: 1,
    accessibilityNeeds: "None noted",
    incomeRange: "$1,400–$1,800/mo",
    notes: "Pending intake. Waiting for income verification.",
    status: "pending",
  },
];

// ─── Housing search results ───────────────────────────────────────────────────

export interface DemoProperty {
  id: string;
  address: string;
  community: string;
  bedrooms: number;
  /** Monthly rent in USD */
  monthlyRent: number;
  /** ISO date string */
  availableDate: string;
  landlordContact: string;
  notes: string;
}

export const DEMO_PROPERTIES: DemoProperty[] = [
  {
    id: "unit-001",
    address: "412 Maple Street, Unit 4B",
    community: "Eastside",
    bedrooms: 1,
    monthlyRent: 1250,
    availableDate: "2026-08-01",
    landlordContact: "Robert Greene — (404) 555-0118",
    notes: "Pet-friendly. Laundry in unit. Bus line 22 nearby.",
  },
  {
    id: "unit-002",
    address: "88 Northview Blvd, Apt 2A",
    community: "Northview",
    bedrooms: 2,
    monthlyRent: 1650,
    availableDate: "2026-08-15",
    landlordContact: "Maria Santos — (404) 555-0276",
    notes: "Elevator building. Near elementary school and transit.",
  },
  {
    id: "unit-003",
    address: "301 Central Ave, Room 12",
    community: "Downtown",
    bedrooms: 0,
    monthlyRent: 750,
    availableDate: "2026-07-28",
    landlordContact: "Downtown SRO Mgmt — (404) 555-0330",
    notes: "SRO. Shared kitchen. Utilities included.",
  },
  {
    id: "unit-004",
    address: "19 Oak Lane, Unit 1C",
    community: "Westpark",
    bedrooms: 1,
    monthlyRent: 1100,
    availableDate: "2026-09-01",
    landlordContact: "Helen Park — (404) 555-0441",
    notes: "Ground floor. ADA compliant. Senior-friendly building.",
  },
];

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface DemoPlan {
  id: string;
  name: string;
  /** Display price string */
  price: string;
  period: string;
  description: string;
  features: string[];
  limitations: string[];
  /** Whether this is the recommended/highlighted plan */
  recommended: boolean;
}

export const DEMO_PLANS: DemoPlan[] = [
  {
    id: "tier-1",
    name: "Tier 1",
    price: "$49.99",
    period: "per month",
    description:
      "For solo practitioners and independent housing coordinators.",
    features: [
      "1 Organization Owner",
      "Unlimited projects",
      "Full placement workflow",
      "Housing Search",
      "People & Contacts",
      "Tasks",
    ],
    limitations: ["No staff accounts", "No Admin Console"],
    recommended: false,
  },
  {
    id: "tier-2",
    name: "Tier 2",
    price: "$79",
    period: "per month — launch price",
    description:
      "For teams managing multiple coordinators and caseloads.",
    features: [
      "1 Organization Owner",
      "Unlimited staff accounts",
      "Admin Console",
      "Unlimited projects",
      "Full placement workflow",
      "Housing Search",
      "People & Contacts",
      "Tasks",
    ],
    limitations: [],
    recommended: true,
  },
];
