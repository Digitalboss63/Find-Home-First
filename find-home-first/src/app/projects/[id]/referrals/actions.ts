"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { projects } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import type { MarketReportSnapshot } from "@/lib/export/types";
import { getLatestReport } from "@/lib/repository-intelligence";
import {
  createManualReferralPartner,
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
const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export async function addManualCaseworkerAction(input: {
  projectId: string;
  organizationName: string;
  programName?: string;
  contactName: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  serviceArea: string;
  sourceUrl: string;
  notes?: string;
}): Promise<ActionResult> {
  try {
    const organizationName = clean(input.organizationName, 160);
    const contactName = clean(input.contactName, 120);
    const programName = clean(input.programName, 160) ?? "Referral / Intake Team";
    const roleTitle = clean(input.roleTitle, 120);
    const email = clean(input.email, 240);
    const phone = clean(input.phone, 60);
    const serviceArea = clean(input.serviceArea, 160);
    const notes = clean(input.notes, 2000);

    if (!organizationName || !contactName || !serviceArea) {
      return { ok: false, error: "Enter the organization, contact name, and service area." };
    }
    if (!email && !phone) {
      return { ok: false, error: "Enter an email address or phone number for this contact." };
    }
    if (email && !SIMPLE_EMAIL.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }

    let sourceUrl: string;
    try {
      const parsed = new URL(input.sourceUrl.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
      sourceUrl = parsed.toString();
    } catch {
      return { ok: false, error: "Enter the official organization or staff-page URL used to verify this contact." };
    }

    const { db, organizationId } = await authorizeProject(input.projectId);
    const outcome = await createManualReferralPartner(db, organizationId, input.projectId, {
      organizationName,
      programName,
      contactName,
      roleTitle,
      email,
      phone,
      serviceArea,
      sourceUrl,
      notes,
      sourceDate: new Date().toISOString().slice(0, 10),
    });
    revalidatePath(`/projects/${input.projectId}/referrals`);
    return outcome === "created"
      ? { ok: true, message: "Caseworker added to Needs verification." }
      : { ok: false, error: "That organization and program are already in this project's list. Update the existing card instead." };
  } catch {
    return { ok: false, error: "The caseworker contact could not be added." };
  }
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
    if (current !== "seeking_referrals") {
      return { ok: false, error: "Secure and prepare the property before starting referral outreach." };
    }
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/referrals`);
    return { ok: true, message: "Referral outreach is active." };
  } catch {
    return { ok: false, error: "Referral outreach could not be started." };
  }
}
