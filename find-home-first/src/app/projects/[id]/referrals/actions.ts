"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { projects, projectStatusHistory } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import type { MarketReportSnapshot } from "@/lib/export/types";
import { getLatestReport } from "@/lib/repository-intelligence";
import {
  listReferralPartners,
  promoteReferralPartnerToContact,
  updateReferralPartner,
  upsertReferralPartnerSeeds,
} from "@/lib/repository-referrals";
import { projectBelongsToOrg } from "@/lib/repository";
import {
  buildReferralPartnerSeeds,
  determinePartnerEligibility,
  type ReferralCapacity,
  type VerificationStatus,
} from "@/lib/referral-partners";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const VERIFICATION = new Set<VerificationStatus>(["official_source", "needs_verification", "confirmed"]);
const CAPACITY = new Set<ReferralCapacity>(["confirmed_external", "needs_confirmation", "no_external_referrals"]);
const OUTREACH = new Set(["not_contacted", "contacted", "confirmed", "not_a_fit"]);

function clean(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}
async function authorizeProject(projectId: string) {
  if (!projectId || projectId.length > 80) throw new Error("Invalid project");
  const ctx = await requireOrganization();
  const db = getDb();
  if (!db) throw new Error("Database unavailable");
  if (!(await projectBelongsToOrg(projectId, ctx.organizationId))) throw new Error("Project not found");
  return { ...ctx, db };
}

export async function generateReferralPartnersAction(projectId: string): Promise<ActionResult> {
  try {
    const { db, organizationId } = await authorizeProject(projectId);
    const report = await getLatestReport(db, organizationId, projectId);
    if (!report) return { ok: false, error: "Generate the City Report before building the referral list." };

    let snapshot: MarketReportSnapshot;
    try {
      snapshot = JSON.parse(report.reportJson) as MarketReportSnapshot;
    } catch {
      return { ok: false, error: "The saved City Report could not be read. Update the report and try again." };
    }
    if (!Array.isArray(snapshot.programs) || !snapshot.geography?.city) {
      return { ok: false, error: "The saved City Report is incomplete. Update the report and try again." };
    }

    const seeds = buildReferralPartnerSeeds(snapshot);
    if (seeds.length === 0) {
      return { ok: false, error: "No source-backed referral channels were found in this City Report." };
    }
    await upsertReferralPartnerSeeds(db, organizationId, projectId, seeds);
    revalidatePath(`/projects/${projectId}/referrals`);
    return { ok: true, message: `${seeds.length} source-backed referral channels added or updated.` };
  } catch {
    return { ok: false, error: "The referral list could not be generated." };
  }
}

export async function saveReferralPartnerAction(input: {
  projectId: string;
  candidateId: string;
  contactName?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  verificationStatus: string;
  referralCapacityStatus: string;
  operatesCompetingHousing: boolean | null;
  outreachStatus: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const verification = input.verificationStatus as VerificationStatus;
    const capacity = input.referralCapacityStatus as ReferralCapacity;
    if (!VERIFICATION.has(verification) || !CAPACITY.has(capacity) || !OUTREACH.has(input.outreachStatus)) {
      return { ok: false, error: "Choose valid verification, referral, and outreach statuses." };
    }
    if (input.operatesCompetingHousing !== null && typeof input.operatesCompetingHousing !== "boolean") {
      return { ok: false, error: "Choose a valid housing-operator status." };
    }
    const { db, organizationId } = await authorizeProject(input.projectId);
    const eligibility = determinePartnerEligibility({
      verificationStatus: verification,
      referralCapacityStatus: capacity,
      operatesCompetingHousing: input.operatesCompetingHousing,
    });
    const saved = await updateReferralPartner(db, organizationId, input.projectId, input.candidateId, {
      contactName: clean(input.contactName, 120),
      roleTitle: clean(input.roleTitle, 120),
      email: clean(input.email, 240),
      phone: clean(input.phone, 60),
      verificationStatus: verification,
      referralCapacityStatus: capacity,
      operatesCompetingHousing: input.operatesCompetingHousing,
      eligibilityStatus: eligibility.status,
      eligibilityReason: eligibility.reason,
      outreachStatus: input.outreachStatus,
      notes: clean(input.notes, 2000),
    });
    if (!saved) return { ok: false, error: "Referral source not found." };
    revalidatePath(`/projects/${input.projectId}/referrals`);
    return { ok: true, message: "Referral source updated." };
  } catch {
    return { ok: false, error: "The referral source could not be updated." };
  }
}

export async function addQualifiedPartnerToContactsAction(
  projectId: string,
  candidateId: string
): Promise<ActionResult> {
  try {
    const { db, organizationId } = await authorizeProject(projectId);
    const contactId = await promoteReferralPartnerToContact(db, organizationId, projectId, candidateId);
    if (!contactId) return { ok: false, error: "Confirm this source as qualified before adding it to contacts." };
    revalidatePath(`/projects/${projectId}/referrals`);
    revalidatePath("/people");
    return { ok: true, message: "Qualified referral source added to People & Contacts." };
  } catch {
    return { ok: false, error: "The referral source could not be added to contacts." };
  }
}

export async function startReferralOutreachAction(projectId: string): Promise<ActionResult> {
  try {
    const { db, organizationId } = await authorizeProject(projectId);
    const candidates = await listReferralPartners(db, organizationId, projectId);
    if (!candidates.some((candidate) => candidate.eligibilityStatus !== "excluded")) {
      return { ok: false, error: "Build and review the referral list before starting outreach." };
    }
    const rows = await db
      .select({ status: projects.currentStatus })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
      .limit(1);
    const current = rows[0]?.status;
    if (!current) return { ok: false, error: "Project not found." };
    if (current !== "preparing_property" && current !== "seeking_referrals") {
      return { ok: false, error: "Secure and prepare the property before starting referral outreach." };
    }
    if (current === "preparing_property") {
      await db.transaction(async (tx) => {
        await tx.update(projects).set({
          currentStatus: "seeking_referrals",
          nextAction: "Contact qualified referral sources and request placement candidates.",
          updatedAt: new Date(),
        }).where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
        await tx.insert(projectStatusHistory).values({
          projectId,
          previousStatus: current,
          newStatus: "seeking_referrals",
          reason: "Referral outreach started from the verified partner list",
        });
      });
    }
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/referrals`);
    return { ok: true, message: "Referral outreach is active." };
  } catch {
    return { ok: false, error: "Referral outreach could not be started." };
  }
}
