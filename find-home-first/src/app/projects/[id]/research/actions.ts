"use server";

import { requireOrganization } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { projects, projectStatusHistory, projectMarketResearch } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { upsertMarketResearch, projectBelongsToOrg } from "@/lib/repository";
import type { MarketResearchView } from "@/lib/repository";
import { searchRentalListings } from "@/lib/rentcast";
import type { RentCastListing } from "@/lib/rentcast";
import { checkApprovalRequirements } from "@/lib/market-research-validation";

export interface ResearchActionState {
  error: string | null;
  savedAt: string | null;
}

// ── Extract form fields ────────────────────────────────────────────────────────

function extractResearchData(
  formData: FormData
): Partial<Omit<MarketResearchView, "id" | "projectId" | "updatedAt">> {
  const str = (key: string): string | null =>
    ((formData.get(key) as string) ?? "").trim() || null;
  const bool = (key: string): boolean =>
    formData.get(key) === "true" || formData.get(key) === "on";

  return {
    targetPopulationSize: str("targetPopulationSize"),
    referralOrgs: str("referralOrgs"),
    expectedResidentsPerMonth: str("expectedResidentsPerMonth"),
    demandEvidenceNotes: str("demandEvidenceNotes"),
    demandRating: str("demandRating"),
    fundingSource: str("fundingSource"),
    expectedPaymentPerResident: str("expectedPaymentPerResident"),
    expectedResidentContribution: str("expectedResidentContribution"),
    expectedOccupancy: str("expectedOccupancy"),
    estimatedMonthlyRevenue: str("estimatedMonthlyRevenue"),
    fundingNotes: str("fundingNotes"),
    targetPropertyType: str("targetPropertyType"),
    minimumBedrooms: str("minimumBedrooms"),
    maxAcceptableLease: str("maxAcceptableLease"),
    estimatedUtilities: str("estimatedUtilities"),
    estimatedFurnishingCost: str("estimatedFurnishingCost"),
    expectedPrivateRoomCapacity: str("expectedPrivateRoomCapacity"),
    estimatedRentalInventory: str("estimatedRentalInventory"),
    typicalLocalRent: str("typicalLocalRent"),
    avgDaysListed: str("avgDaysListed"),
    tiredOwnerIndicators: str("tiredOwnerIndicators"),
    landlordOutreachNotes: str("landlordOutreachNotes"),
    supplySourceLinks: str("supplySourceLinks"),
    transportationAccess: str("transportationAccess"),
    vaMedicalServices: str("vaMedicalServices"),
    groceryEssentialServices: str("groceryEssentialServices"),
    referralPartnerProximity: str("referralPartnerProximity"),
    zoningConcerns: str("zoningConcerns"),
    neighborhoodConcerns: str("neighborhoodConcerns"),
    locationNotes: str("locationNotes"),
    riskFundingUncertainty: bool("riskFundingUncertainty"),
    riskInsufficientSupply: bool("riskInsufficientSupply"),
    riskRentTooHigh: bool("riskRentTooHigh"),
    riskRegulatoryIssue: bool("riskRegulatoryIssue"),
    riskWeakReferralPipeline: bool("riskWeakReferralPipeline"),
    riskOther: bool("riskOther"),
    riskMitigationNotes: str("riskMitigationNotes"),
    holdReason: str("holdReason"),
    otherMonthlyCosts: str("otherMonthlyCosts"),
  };
}

// ── Save draft ─────────────────────────────────────────────────────────────────

export async function saveResearchDraftAction(
  _prev: ResearchActionState,
  formData: FormData
): Promise<ResearchActionState> {
  const { organizationId } = await requireOrganization();
  const projectId = (formData.get("projectId") as string) ?? "";

  if (!projectId) return { error: "Project ID missing.", savedAt: null };
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { error: "Project not found.", savedAt: null };

  const data = extractResearchData(formData);
  const ok = await upsertMarketResearch(projectId, organizationId, data);
  if (!ok) return { error: "Save failed. Please try again.", savedAt: null };

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/research`);
  return { error: null, savedAt: new Date().toISOString() };
}

// ── Approve market ─────────────────────────────────────────────────────────────

export async function approveMarketAction(
  _prev: ResearchActionState,
  formData: FormData
): Promise<ResearchActionState> {
  const { organizationId } = await requireOrganization();
  const projectId = (formData.get("projectId") as string) ?? "";

  if (!projectId) return { error: "Project ID missing.", savedAt: null };
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { error: "Project not found.", savedAt: null };

  // ── Server-side validation (shared with client) ──────────────────────────
  const f = (key: string) => ((formData.get(key) as string) ?? "").trim();
  const b = (key: string) => formData.get(key) === "true";

  const approvalFields: Record<string, string> = {
    demandRating:               f("demandRating"),
    demandEvidenceNotes:        f("demandEvidenceNotes"),
    fundingSource:              f("fundingSource"),
    expectedPaymentPerResident: f("expectedPaymentPerResident"),
    expectedOccupancy:          f("expectedOccupancy"),
    expectedPrivateRoomCapacity:f("expectedPrivateRoomCapacity"),
    maxAcceptableLease:         f("maxAcceptableLease"),
    estimatedRentalInventory:   f("estimatedRentalInventory"),
    supplySourceLinks:          f("supplySourceLinks"),
    transportationAccess:       f("transportationAccess"),
    locationNotes:              f("locationNotes"),
  };

  const anyRiskChecked =
    b("riskFundingUncertainty") || b("riskInsufficientSupply") ||
    b("riskRentTooHigh")        || b("riskRegulatoryIssue")    ||
    b("riskWeakReferralPipeline")|| b("riskOther");

  const { missing } = checkApprovalRequirements(approvalFields, anyRiskChecked, f("riskMitigationNotes"));
  if (missing.length > 0) {
    return { error: missing[0].serverError, savedAt: null };
  }

  const data = { ...extractResearchData(formData), decisionStatus: "approved" };
  const db = getDb();
  if (!db) return { error: "Database unavailable.", savedAt: null };

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(projectMarketResearch)
        .values({ projectId, organizationId, ...data, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: projectMarketResearch.projectId,
          set: { ...data, updatedAt: new Date() },
        });

      const [proj] = await tx
        .select({ currentStatus: projects.currentStatus })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      await tx
        .update(projects)
        .set({
          currentStatus: "city_approved",
          nextAction: "Find suitable properties and motivated owners",
          blocker: null,
          blockerReason: null,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));

      await tx.insert(projectStatusHistory).values({
        projectId,
        previousStatus: proj?.currentStatus ?? null,
        newStatus: "city_approved",
        reason: "Market research approved",
      });
    });
  } catch (err) {
    console.error("[approveMarketAction] failed:", err);
    return { error: "Failed to approve market. Please try again.", savedAt: null };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/research`);
  revalidatePath("/projects");
  revalidatePath("/");

  redirect(`/housing-search?project=${projectId}`);
}

// ── Put on hold ────────────────────────────────────────────────────────────────

export async function holdResearchAction(
  _prev: ResearchActionState,
  formData: FormData
): Promise<ResearchActionState> {
  const { organizationId } = await requireOrganization();
  const projectId = (formData.get("projectId") as string) ?? "";

  if (!projectId) return { error: "Project ID missing.", savedAt: null };
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { error: "Project not found.", savedAt: null };

  const holdReason = ((formData.get("holdReason") as string) ?? "").trim();
  if (!holdReason) return { error: "A hold reason is required.", savedAt: null };

  const data = { ...extractResearchData(formData), decisionStatus: "on_hold", holdReason };
  const db = getDb();
  if (!db) return { error: "Database unavailable.", savedAt: null };

  try {
    await db.transaction(async (tx) => {
      // Save research data
      await tx
        .insert(projectMarketResearch)
        .values({ projectId, organizationId, ...data, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: projectMarketResearch.projectId,
          set: { ...data, updatedAt: new Date() },
        });

      // Get current status for history
      const [proj] = await tx
        .select({ currentStatus: projects.currentStatus })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      // Keep currentStatus = researching_city, set blocker
      await tx
        .update(projects)
        .set({
          currentStatus: "researching_city",
          blocker: "research_on_hold",
          blockerReason: holdReason,
          nextAction: `Resume research: ${holdReason}`,
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));

      await tx.insert(projectStatusHistory).values({
        projectId,
        previousStatus: proj?.currentStatus ?? null,
        newStatus: "researching_city",
        reason: `Research put on hold: ${holdReason}`,
      });
    });
  } catch (err) {
    console.error("[holdResearchAction] failed:", err);
    return { error: "Failed to put research on hold. Please try again.", savedAt: null };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/research`);
  revalidatePath("/projects");
  return { error: null, savedAt: new Date().toISOString() };
}

// ── Reject market ─────────────────────────────────────────────────────────────

export async function rejectMarketAction(
  _prev: ResearchActionState,
  formData: FormData
): Promise<ResearchActionState> {
  const { organizationId } = await requireOrganization();
  const projectId = (formData.get("projectId") as string) ?? "";

  if (!projectId) return { error: "Project ID missing.", savedAt: null };
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { error: "Project not found.", savedAt: null };

  const data = { ...extractResearchData(formData), decisionStatus: "rejected" };
  const db = getDb();
  if (!db) return { error: "Database unavailable.", savedAt: null };

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(projectMarketResearch)
        .values({ projectId, organizationId, ...data, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: projectMarketResearch.projectId,
          set: { ...data, updatedAt: new Date() },
        });

      const [proj] = await tx
        .select({ currentStatus: projects.currentStatus })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)))
        .limit(1);

      await tx
        .update(projects)
        .set({
          currentStatus: "closed_not_proceeding",
          nextAction: "Market rejected — research concluded",
          blocker: "Market not viable",
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));

      await tx.insert(projectStatusHistory).values({
        projectId,
        previousStatus: proj?.currentStatus ?? null,
        newStatus: "closed_not_proceeding",
        reason: "Market research rejected",
      });
    });
  } catch (err) {
    console.error("[rejectMarketAction] failed:", err);
    return { error: "Failed to reject market. Please try again.", savedAt: null };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
  redirect(`/projects/${projectId}`);
}

// ── Test property search (preview only — no lead creation, no status change) ──

export interface TestSearchResult {
  listings: RentCastListing[];
  error: string | null;
  totalFound: number;
}

export async function testPropertySearchAction(
  projectId: string,
  city: string,
  state: string,
  minBedrooms: string,
  maxRent: string
): Promise<TestSearchResult> {
  const { organizationId } = await requireOrganization();

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) return { listings: [], error: "Project not found.", totalFound: 0 };

  if (!city || !state) {
    return { listings: [], error: "City and state are required for property search.", totalFound: 0 };
  }

  const params = {
    city,
    state,
    bedrooms: minBedrooms ? parseInt(minBedrooms, 10) : undefined,
    maxPrice: maxRent ? parseInt(maxRent, 10) : undefined,
    status: "active",
    limit: 5,
  };

  const result = await searchRentalListings(params);
  return {
    listings: result.listings.slice(0, 5),
    error: result.error ?? null,
    totalFound: result.listings.length,
  };
}
