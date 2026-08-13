import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { DrizzleDb } from "@/db/client";
import { contacts, referralPartnerCandidates } from "@/db/schema";
import type { ReferralPartnerSeed } from "@/lib/referral-partners";

export interface ReferralPartnerView {
  id: string;
  projectId: string;
  organizationName: string;
  programName: string;
  partnerCategory: string;
  contactName: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  serviceArea: string | null;
  populationServed: string | null;
  referralProcess: string | null;
  sourceUrl: string;
  sourceAgency: string;
  sourceDate: string;
  verificationStatus: string;
  referralCapacityStatus: string;
  operatesCompetingHousing: boolean | null;
  eligibilityStatus: string;
  eligibilityReason: string;
  outreachStatus: string;
  notes: string | null;
  promotedContactId: string | null;
  updatedAt: Date;
}

export interface ManualReferralPartnerInput {
  organizationName: string;
  programName: string;
  contactName: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  serviceArea: string;
  sourceUrl: string;
  notes: string | null;
  sourceDate: string;
}

export async function createManualReferralPartner(
  db: DrizzleDb,
  organizationId: string,
  projectId: string,
  input: ManualReferralPartnerInput
): Promise<"created" | "duplicate"> {
  const rows = await db
    .insert(referralPartnerCandidates)
    .values({
      organizationId,
      projectId,
      organizationName: input.organizationName,
      programName: input.programName,
      partnerCategory: "manual_caseworker",
      contactName: input.contactName,
      roleTitle: input.roleTitle,
      email: input.email,
      phone: input.phone,
      serviceArea: input.serviceArea,
      populationServed: "Confirm with contact",
      referralProcess: "Operator-entered contact; confirm the current external-referral and intake process.",
      sourceUrl: input.sourceUrl,
      sourceAgency: input.organizationName,
      sourceDate: input.sourceDate,
      verificationStatus: "needs_verification",
      referralCapacityStatus: "needs_confirmation",
      operatesCompetingHousing: null,
      eligibilityStatus: "review_needed",
      eligibilityReason: "Manually entered contact. Confirm the person's current role and external-referral capacity before relying on this source.",
      outreachStatus: "not_contacted",
      notes: input.notes,
    })
    .onConflictDoNothing({
      target: [
        referralPartnerCandidates.organizationId,
        referralPartnerCandidates.projectId,
        referralPartnerCandidates.organizationName,
        referralPartnerCandidates.programName,
      ],
    })
    .returning({ id: referralPartnerCandidates.id });
  return rows.length === 1 ? "created" : "duplicate";
}

export async function listReferralPartners(
  db: DrizzleDb,
  organizationId: string,
  projectId: string
): Promise<ReferralPartnerView[]> {
  return db
    .select({
      id: referralPartnerCandidates.id,
      projectId: referralPartnerCandidates.projectId,
      organizationName: referralPartnerCandidates.organizationName,
      programName: referralPartnerCandidates.programName,
      partnerCategory: referralPartnerCandidates.partnerCategory,
      contactName: referralPartnerCandidates.contactName,
      roleTitle: referralPartnerCandidates.roleTitle,
      email: referralPartnerCandidates.email,
      phone: referralPartnerCandidates.phone,
      serviceArea: referralPartnerCandidates.serviceArea,
      populationServed: referralPartnerCandidates.populationServed,
      referralProcess: referralPartnerCandidates.referralProcess,
      sourceUrl: referralPartnerCandidates.sourceUrl,
      sourceAgency: referralPartnerCandidates.sourceAgency,
      sourceDate: referralPartnerCandidates.sourceDate,
      verificationStatus: referralPartnerCandidates.verificationStatus,
      referralCapacityStatus: referralPartnerCandidates.referralCapacityStatus,
      operatesCompetingHousing: referralPartnerCandidates.operatesCompetingHousing,
      eligibilityStatus: referralPartnerCandidates.eligibilityStatus,
      eligibilityReason: referralPartnerCandidates.eligibilityReason,
      outreachStatus: referralPartnerCandidates.outreachStatus,
      notes: referralPartnerCandidates.notes,
      promotedContactId: referralPartnerCandidates.promotedContactId,
      updatedAt: referralPartnerCandidates.updatedAt,
    })
    .from(referralPartnerCandidates)
    .where(and(
      eq(referralPartnerCandidates.organizationId, organizationId),
      eq(referralPartnerCandidates.projectId, projectId)
    ))
    .orderBy(asc(referralPartnerCandidates.organizationName));
}

export async function upsertReferralPartnerSeeds(
  db: DrizzleDb,
  organizationId: string,
  projectId: string,
  seeds: ReferralPartnerSeed[]
): Promise<number> {
  for (const seed of seeds) {
    await db
      .insert(referralPartnerCandidates)
      .values({ organizationId, projectId, ...seed })
      .onConflictDoUpdate({
        target: [
          referralPartnerCandidates.organizationId,
          referralPartnerCandidates.projectId,
          referralPartnerCandidates.organizationName,
          referralPartnerCandidates.programName,
        ],
        set: {
          partnerCategory: seed.partnerCategory,
          serviceArea: seed.serviceArea,
          populationServed: seed.populationServed,
          referralProcess: seed.referralProcess,
          sourceUrl: seed.sourceUrl,
          sourceAgency: seed.sourceAgency,
          sourceDate: seed.sourceDate,
          updatedAt: new Date(),
        },
      });
  }
  return seeds.length;
}

export async function updateReferralPartner(
  db: DrizzleDb,
  organizationId: string,
  projectId: string,
  candidateId: string,
  values: {
    contactName: string | null;
    roleTitle: string | null;
    email: string | null;
    phone: string | null;
    verificationStatus: string;
    referralCapacityStatus: string;
    operatesCompetingHousing: boolean | null;
    eligibilityStatus: string;
    eligibilityReason: string;
    outreachStatus: string;
    notes: string | null;
  }
): Promise<boolean> {
  const rows = await db
    .update(referralPartnerCandidates)
    .set({ ...values, updatedAt: new Date() })
    .where(and(
      eq(referralPartnerCandidates.id, candidateId),
      eq(referralPartnerCandidates.organizationId, organizationId),
      eq(referralPartnerCandidates.projectId, projectId)
    ))
    .returning({ id: referralPartnerCandidates.id });
  return rows.length === 1;
}

export async function promoteReferralPartnerToContact(
  db: DrizzleDb,
  organizationId: string,
  projectId: string,
  candidateId: string
): Promise<string | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(referralPartnerCandidates)
      .where(and(
        eq(referralPartnerCandidates.id, candidateId),
        eq(referralPartnerCandidates.organizationId, organizationId),
        eq(referralPartnerCandidates.projectId, projectId)
      ))
      .limit(1);
    const candidate = rows[0];
    if (!candidate || candidate.eligibilityStatus !== "qualified") return null;
    if (candidate.promotedContactId) return candidate.promotedContactId;

    const inserted = await tx
      .insert(contacts)
      .values({
        organizationId,
        contactType: "referral",
        name: candidate.contactName?.trim() || `${candidate.programName} Intake`,
        organizationName: candidate.organizationName,
        roleTitle: candidate.roleTitle,
        email: candidate.email,
        phone: candidate.phone,
        notes: [
          `Referral program: ${candidate.programName}`,
          candidate.notes,
          `Official source: ${candidate.sourceUrl}`,
        ].filter(Boolean).join("\n"),
      })
      .returning({ id: contacts.id });
    const contactId = inserted[0].id;
    await tx
      .update(referralPartnerCandidates)
      .set({ promotedContactId: contactId, updatedAt: new Date() })
      .where(eq(referralPartnerCandidates.id, candidateId));
    return contactId;
  });
}
