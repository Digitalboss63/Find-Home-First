import type { MarketReportSnapshot, ProgramOpportunity } from "@/lib/export/types";

export type PartnerEligibility = "qualified" | "review_needed" | "excluded";
export type ReferralCapacity = "confirmed_external" | "needs_confirmation" | "no_external_referrals";

/**
 * The referral list is useful as soon as market research is complete. Operators
 * should be able to identify and verify referral sources while they search for
 * and secure a property; outreach activation remains separately gated until
 * the property-preparation stage.
 */
export const REFERRAL_FINDER_AVAILABLE_STATUSES = new Set([
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
]);

export function canUseReferralFinder(currentStatus: string): boolean {
  return REFERRAL_FINDER_AVAILABLE_STATUSES.has(currentStatus);
}

/**
 * Opens a focused public web search without calling a paid API or attempting
 * to scrape a person's name. The operator must confirm the result against an
 * official organization page before saving it.
 */
export function buildCaseworkerSearchUrl(
  organizationName: string,
  serviceArea?: string | null
): string {
  const query = [
    `"${organizationName.trim()}"`,
    serviceArea?.trim(),
    '(caseworker OR "case manager" OR "intake coordinator" OR "referral coordinator")',
  ]
    .filter(Boolean)
    .join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
export type VerificationStatus = "official_source" | "needs_verification" | "confirmed";

export interface ReferralPartnerSeed {
  organizationName: string;
  programName: string;
  partnerCategory: string;
  serviceArea: string;
  populationServed: string;
  referralProcess: string | null;
  sourceUrl: string;
  sourceAgency: string;
  sourceDate: string;
  verificationStatus: VerificationStatus;
  referralCapacityStatus: ReferralCapacity;
  operatesCompetingHousing: boolean | null;
  eligibilityStatus: PartnerEligibility;
  eligibilityReason: string;
}
const OFFICIAL_SOURCES: Record<string, { url: string; agency: string }> = {
  va_hudvash: {
    url: "https://department.va.gov/homeless/hud-vash/",
    agency: "U.S. Department of Veterans Affairs",
  },
  va_ssvf: {
    url: "https://department.va.gov/homeless/supportive-services-for-veteran-families/",
    agency: "U.S. Department of Veterans Affairs",
  },
  hud_coc: {
    url: "https://www.hud.gov/hud-partners/community-coc",
    agency: "U.S. Department of Housing and Urban Development",
  },
};

function sourceFor(program: ProgramOpportunity) {
  return OFFICIAL_SOURCES[program.sourceKey] ?? OFFICIAL_SOURCES.hud_coc;
}

function sourceDate(value: string | null | undefined, fallback: string): string {
  const candidate = value && /^\d{4}-\d{2}(?:-\d{2})?$/.test(value)
    ? `${value.slice(0, 7)}-01`
    : fallback.slice(0, 10);
  return candidate;
}

function concreteOrganization(value: string | null): value is string {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return !normalized.includes("not verified") && !normalized.includes("requires service partner");
}

function classifyProgram(program: ProgramOpportunity): Pick<ReferralPartnerSeed,
  "eligibilityStatus" | "eligibilityReason" | "referralCapacityStatus" | "operatesCompetingHousing"
> {
  const text = [
    program.programName,
    program.findHomeFirstRole,
    program.sharedHousingCompatibility,
    program.currentAvailability,
    program.unresolvedRestrictions,
  ].filter(Boolean).join(" ").toLowerCase();

  if (text.includes("not aligned") || text.includes("transitional model")) {
    return {
      eligibilityStatus: "excluded",
      eligibilityReason: "This program operates a competing or transitional housing model rather than referring residents into outside operator housing.",
      referralCapacityStatus: "no_external_referrals",
      operatesCompetingHousing: true,
    };
  }

  if (text.includes("not currently accepting") || text.includes("allocation exhausted")) {
    return {
      eligibilityStatus: "excluded",
      eligibilityReason: "The saved City Report indicates this channel is not currently accepting new referrals.",
      referralCapacityStatus: "no_external_referrals",
      operatesCompetingHousing: false,
    };
  }

  const coordinatedEntry = (program.referralProcess ?? "").toLowerCase().includes("coordinated entry");
  if (coordinatedEntry) {
    return {
      eligibilityStatus: "qualified",
      eligibilityReason: "Official program information identifies an external coordinated-entry referral process. Confirm the current intake contact before outreach.",
      referralCapacityStatus: "confirmed_external",
      operatesCompetingHousing: false,
    };
  }

  return {
    eligibilityStatus: "review_needed",
    eligibilityReason: "Official program channel found. Confirm that it has active caseworkers, refers to outside housing operators, and is accepting referrals.",
    referralCapacityStatus: "needs_confirmation",
    operatesCompetingHousing: null,
  };
}

function categoryFor(program: ProgramOpportunity): string {
  const name = program.programName.toLowerCase();
  if (name.includes("hud-vash") || name.includes("ssvf")) return "veteran_case_management";
  if ((program.referralProcess ?? "").toLowerCase().includes("coordinated entry")) return "coordinated_entry";
  if (name.includes("housing choice") || name.includes("section 8") || name.includes("voucher")) return "public_housing";
  return "other";
}

/**
 * Builds a source-backed referral list from the immutable City Report snapshot.
 * It does not call a search engine or invent individual names.
 */
export function buildReferralPartnerSeeds(report: MarketReportSnapshot): ReferralPartnerSeed[] {
  const seeds: ReferralPartnerSeed[] = [];
  const seen = new Set<string>();
  const fallbackDate = report.generatedAt;
  const serviceArea = [report.geography.city, report.geography.stateAbbr].filter(Boolean).join(", ");

  for (const program of report.programs) {
    if (!concreteOrganization(program.localAdminOrg)) continue;
    const source = sourceFor(program);
    const classification = classifyProgram(program);
    const key = `${program.localAdminOrg.toLowerCase()}|${program.programName.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    seeds.push({
      organizationName: program.localAdminOrg,
      programName: program.programName,
      partnerCategory: categoryFor(program),
      serviceArea,
      populationServed: program.populationServed,
      referralProcess: program.referralProcess,
      sourceUrl: source.url,
      sourceAgency: source.agency,
      sourceDate: sourceDate(program.reportingDate, fallbackDate),
      verificationStatus: "official_source",
      ...classification,
    });
  }

  const targetIsVeterans = `${report.targetPopulation} ${report.bestTargetPopulation}`.toLowerCase().includes("veteran");
  if (targetIsVeterans && !seeds.some((seed) => seed.programName.includes("SSVF"))) {
    seeds.push({
      organizationName: "VA SSVF Provider Directory",
      programName: "SSVF local provider intake",
      partnerCategory: "directory",
      serviceArea,
      populationServed: report.targetPopulation,
      referralProcess: "Use the official VA provider directory to identify and confirm the current local intake team.",
      sourceUrl: OFFICIAL_SOURCES.va_ssvf.url,
      sourceAgency: OFFICIAL_SOURCES.va_ssvf.agency,
      sourceDate: sourceDate(null, fallbackDate),
      verificationStatus: "official_source",
      referralCapacityStatus: "needs_confirmation",
      operatesCompetingHousing: null,
      eligibilityStatus: "review_needed",
      eligibilityReason: "Official provider directory found; select and verify a current local provider before treating it as a referral partner.",
    });
  }

  const order: Record<PartnerEligibility, number> = { qualified: 0, review_needed: 1, excluded: 2 };
  return seeds.sort((a, b) => order[a.eligibilityStatus] - order[b.eligibilityStatus]
    || a.organizationName.localeCompare(b.organizationName));
}

export function determinePartnerEligibility(input: {
  verificationStatus: VerificationStatus;
  referralCapacityStatus: ReferralCapacity;
  operatesCompetingHousing: boolean | null;
}): { status: PartnerEligibility; reason: string } {
  if (input.operatesCompetingHousing === true) {
    return { status: "excluded", reason: "Excluded because this organization operates a competing housing model." };
  }
  if (input.referralCapacityStatus === "no_external_referrals") {
    return { status: "excluded", reason: "Excluded because it does not refer qualified residents to outside housing operators." };
  }
  if (input.verificationStatus === "confirmed" && input.referralCapacityStatus === "confirmed_external") {
    return { status: "qualified", reason: "Confirmed active referral source with external placement capacity." };
  }
  return { status: "review_needed", reason: "Confirm an active intake contact and external-referral capacity before relying on this source." };
}
