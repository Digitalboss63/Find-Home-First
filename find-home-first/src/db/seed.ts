/**
 * Idempotent seed — Find Home First
 *
 * Running this more than once must not duplicate records.
 * Uses a fixed seed organization slug as the idempotency key.
 * All names and contact details are fictional.
 *
 * Run: npm run db:seed
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — cannot seed.");
  process.exit(1);
}

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  console.log("🌱  Seeding Find Home First database…");

  // ── Organization ─────────────────────────────────────────────────────────

  const ORG_NAME = "Find Home First Demo Org";

  let [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.name, ORG_NAME))
    .limit(1);

  if (!org) {
    [org] = await db
      .insert(schema.organizations)
      .values({ name: ORG_NAME })
      .returning();
    console.log("  ✔ Organization created:", org.id);
  } else {
    console.log("  ↩ Organization already exists:", org.id);
  }

  const orgId = org.id;

  // ── Contacts (referral) ──────────────────────────────────────────────────

  const contactSeeds = [
    {
      key: "s.okafor@cha-demo.org",
      name: "Sandra Okafor",
      organizationName: "Community Housing Alliance",
      roleTitle: "Intake Coordinator",
      email: "s.okafor@cha-demo.org",
      phone: "(404) 555-0182",
      notes: "Primary contact for Eastside referrals. Responds quickly by email.",
      contactType: "referral",
    },
    {
      key: "jpriet@nvfs-demo.org",
      name: "James Prieto",
      organizationName: "Northview Family Services",
      roleTitle: "Case Manager",
      email: "jpriet@nvfs-demo.org",
      phone: "(404) 555-0247",
      notes: "Handles family placements with 2–4 members.",
      contactType: "referral",
    },
    {
      key: "l.marsh@dsn-demo.org",
      name: "Linda Marsh",
      organizationName: "Downtown Shelter Network",
      roleTitle: "Director of Housing Transitions",
      email: "l.marsh@dsn-demo.org",
      phone: "(404) 555-0391",
      notes: "Best for SRO and single-adult placements.",
      contactType: "referral",
    },
  ] as const;

  const contactIds: Record<string, string> = {};

  for (const seed of contactSeeds) {
    const existing = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.email, seed.email))
      .limit(1);
    if (existing.length === 0) {
      const [c] = await db
        .insert(schema.contacts)
        .values({
          organizationId: orgId,
          name: seed.name,
          organizationName: seed.organizationName,
          roleTitle: seed.roleTitle,
          email: seed.email,
          phone: seed.phone,
          notes: seed.notes,
          contactType: seed.contactType,
        })
        .returning();
      contactIds[seed.key] = c.id;
      console.log("  ✔ Contact created:", seed.name);
    } else {
      contactIds[seed.key] = existing[0].id;
      console.log("  ↩ Contact already exists:", seed.name);
    }
  }

  // ── Residents ─────────────────────────────────────────────────────────────

  const residentSeeds = [
    {
      key: "marcus-t",
      displayName: "Marcus T.",
      referralKey: "s.okafor@cha-demo.org",
      householdSize: 1,
      bedroomsNeeded: 1,
      accessibilityNeeds: "None noted",
      incomeRange: "$1,000–$1,400/mo",
      notes: "Active project underway. Prefers Eastside.",
      placementStatus: "active",
    },
    {
      key: "rivera-family",
      displayName: "Rivera Family",
      referralKey: "jpriet@nvfs-demo.org",
      householdSize: 4,
      bedroomsNeeded: 2,
      accessibilityNeeds: "Ground-floor or elevator required",
      incomeRange: "$2,200–$2,800/mo",
      notes: "Two children. School district matters — Northview preferred.",
      placementStatus: "active",
    },
    {
      key: "diane-w",
      displayName: "Diane W.",
      referralKey: "l.marsh@dsn-demo.org",
      householdSize: 1,
      bedroomsNeeded: 0,
      accessibilityNeeds: "None noted",
      incomeRange: "$600–$900/mo",
      notes: "Flexible on location. SRO or studio acceptable.",
      placementStatus: "active",
    },
    {
      key: "earl-j",
      displayName: "Earl J.",
      referralKey: "s.okafor@cha-demo.org",
      householdSize: 1,
      bedroomsNeeded: 1,
      accessibilityNeeds: "Wheelchair accessible",
      incomeRange: "$900–$1,200/mo",
      notes: "Placed — Westpark unit confirmed.",
      placementStatus: "placed",
    },
    {
      key: "patricia-b",
      displayName: "Patricia B.",
      referralKey: "jpriet@nvfs-demo.org",
      householdSize: 2,
      bedroomsNeeded: 1,
      accessibilityNeeds: "None noted",
      incomeRange: "$1,400–$1,800/mo",
      notes: "Pending intake. Waiting for income verification.",
      placementStatus: "pending",
    },
  ] as const;

  const residentIds: Record<string, string> = {};

  for (const seed of residentSeeds) {
    const existing = await db
      .select()
      .from(schema.residents)
      .where(eq(schema.residents.displayName, seed.displayName))
      .limit(1);
    if (existing.length === 0) {
      const [r] = await db
        .insert(schema.residents)
        .values({
          organizationId: orgId,
          displayName: seed.displayName,
          referralContactId: contactIds[seed.referralKey] ?? null,
          householdSize: seed.householdSize,
          bedroomsNeeded: seed.bedroomsNeeded,
          accessibilityNeeds: seed.accessibilityNeeds,
          incomeRange: seed.incomeRange,
          notes: seed.notes,
          placementStatus: seed.placementStatus,
        })
        .returning();
      residentIds[seed.key] = r.id;
      console.log("  ✔ Resident created:", seed.displayName);
    } else {
      residentIds[seed.key] = existing[0].id;
      console.log("  ↩ Resident already exists:", seed.displayName);
    }
  }

  // ── Property candidates ──────────────────────────────────────────────────

  const propSeeds = [
    {
      key: "412-maple-4b",
      address: "412 Maple Street, Unit 4B",
      community: "Eastside",
      bedrooms: 1,
      monthlyRent: "1250.00",
      availableDate: "2026-08-01",
      listingStatus: "active",
      notes: "Pet-friendly. Laundry in unit. Bus line 22 nearby.",
    },
    {
      key: "88-northview-2a",
      address: "88 Northview Blvd, Apt 2A",
      community: "Northview",
      bedrooms: 2,
      monthlyRent: "1650.00",
      availableDate: "2026-08-15",
      listingStatus: "active",
      notes: "Elevator building. Near elementary school and transit.",
    },
    {
      key: "301-central-r12",
      address: "301 Central Ave, Room 12",
      community: "Downtown",
      bedrooms: 0,
      monthlyRent: "750.00",
      availableDate: "2026-07-28",
      listingStatus: "active",
      notes: "SRO. Shared kitchen. Utilities included.",
    },
    {
      key: "19-oak-1c",
      address: "19 Oak Lane, Unit 1C",
      community: "Westpark",
      bedrooms: 1,
      monthlyRent: "1100.00",
      availableDate: "2026-09-01",
      listingStatus: "active",
      notes: "Ground floor. ADA compliant. Senior-friendly building.",
    },
  ] as const;

  const propCandidateIds: Record<string, string> = {};

  for (const seed of propSeeds) {
    const existing = await db
      .select()
      .from(schema.propertyCandidates)
      .where(eq(schema.propertyCandidates.address, seed.address))
      .limit(1);
    if (existing.length === 0) {
      const [p] = await db
        .insert(schema.propertyCandidates)
        .values({
          organizationId: orgId,
          provider: "manual",
          address: seed.address,
          community: seed.community,
          bedrooms: seed.bedrooms,
          monthlyRent: seed.monthlyRent,
          availableDate: seed.availableDate,
          listingStatus: seed.listingStatus,
        })
        .returning();
      propCandidateIds[seed.key] = p.id;
      console.log("  ✔ Property candidate created:", seed.address);
    } else {
      propCandidateIds[seed.key] = existing[0].id;
      console.log("  ↩ Property candidate already exists:", seed.address);
    }
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  const projectSeeds = [
    {
      key: "eastside-4b",
      name: "Eastside Rapid Rehousing — Unit 4B",
      community: "Eastside",
      residentKey: "marcus-t",
      currentStatus: "application_in_progress",
      targetMoveIn: "2026-08-15",
      blocker: "Landlord agreement pending signature — follow up by Friday.",
    },
    {
      key: "northview-family",
      name: "Northview Family Placement",
      community: "Northview",
      residentKey: "rivera-family",
      currentStatus: "seeking_referrals",
      targetMoveIn: "2026-08-30",
      blocker: null,
    },
    {
      key: "downtown-sro-r12",
      name: "Downtown SRO — Room 12",
      community: "Downtown",
      residentKey: "diane-w",
      currentStatus: "finding_property",
      targetMoveIn: "2026-09-01",
      blocker: null,
    },
    {
      key: "westpark-senior",
      name: "Westpark Senior Placement",
      community: "Westpark",
      residentKey: "earl-j",
      currentStatus: "moved_in",
      targetMoveIn: "2026-07-10",
      blocker: null,
    },
  ] as const;

  const projectIds: Record<string, string> = {};

  for (const seed of projectSeeds) {
    const existing = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.name, seed.name))
      .limit(1);
    if (existing.length === 0) {
      const [p] = await db
        .insert(schema.projects)
        .values({
          organizationId: orgId,
          name: seed.name,
          community: seed.community,
          residentId: residentIds[seed.residentKey] ?? null,
          currentStatus: seed.currentStatus,
          targetMoveIn: seed.targetMoveIn,
          blocker: seed.blocker ?? null,
        })
        .returning();
      projectIds[seed.key] = p.id;
      // Insert initial status history
      await db.insert(schema.projectStatusHistory).values({
        projectId: p.id,
        previousStatus: null,
        newStatus: seed.currentStatus,
        reason: "Initial seed",
      });
      console.log("  ✔ Project created:", seed.name);
    } else {
      projectIds[seed.key] = existing[0].id;
      console.log("  ↩ Project already exists:", seed.name);
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const taskSeeds = [
    {
      key: "task-001",
      title: "Follow up with landlord on lease signature",
      projectKey: "eastside-4b",
      dueDate: "2026-07-22",
      status: "today",
    },
    {
      key: "task-002",
      title: "Schedule unit walkthrough for Rivera Family",
      projectKey: "northview-family",
      dueDate: "2026-07-22",
      status: "today",
    },
    {
      key: "task-003",
      title: "Submit income verification documents for Diane W.",
      projectKey: "downtown-sro-r12",
      dueDate: "2026-07-25",
      status: "upcoming",
    },
    {
      key: "task-004",
      title: "Search available 2BR units near Northview transit corridor",
      projectKey: "northview-family",
      dueDate: "2026-07-28",
      status: "upcoming",
    },
    {
      key: "task-005",
      title: "Collect signed move-in documentation from Earl J.",
      projectKey: "westpark-senior",
      dueDate: "2026-07-10",
      status: "completed",
    },
    {
      key: "task-006",
      title: "Send welcome packet to Westpark property manager",
      projectKey: "westpark-senior",
      dueDate: "2026-07-11",
      status: "completed",
    },
  ] as const;

  for (const seed of taskSeeds) {
    const existing = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.title, seed.title))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.tasks).values({
        organizationId: orgId,
        projectId: projectIds[seed.projectKey] ?? null,
        title: seed.title,
        dueDate: seed.dueDate,
        status: seed.status,
        completedAt: seed.status === "completed" ? new Date() : null,
      });
      console.log("  ✔ Task created:", seed.title);
    } else {
      console.log("  ↩ Task already exists:", seed.title);
    }
  }

  console.log("\n✅  Seed complete.");
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
