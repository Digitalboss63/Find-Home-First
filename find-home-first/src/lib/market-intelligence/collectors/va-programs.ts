/**
 * VA and local housing program collector.
 *
 * VA national programs (HUD-VASH, SSVF, GPD) are static/known.
 * Local CoC programs (RRH, PSH, Section 8/HCV) use known data where available.
 * "Not Verified" is shown for local implementation details that require
 * direct confirmation with providers.
 */
import type { CollectorResult, VaProgramData, GeoContext } from "../types";

type Program = VaProgramData["programs"][number];

// National VA programs — apply everywhere
const VA_NATIONAL_PROGRAMS: Program[] = [
  {
    programName: "HUD-VASH",
    fitRank: "Best Immediate",
    localAdminOrg: null, // Set by geo-specific data
    sharedHousingCompatibility: "Nationally allowable per VA guidance — local verification required",
    referralProcess: "Not Verified — contact local VAMC HUD-VASH coordinator",
    currentAvailability: "Ongoing program — current referral capacity not confirmed",
    unresolvedRestrictions: "Local shared-housing rules; sublease/master-lease structure; payment standard per room",
    sourceKey: "va_hudvash",
    reportingDate: new Date().toISOString().slice(0, 7),
  },
  {
    programName: "SSVF (Supportive Services for Veteran Families)",
    fitRank: "Best Immediate",
    localAdminOrg: "Not Verified — see current VA SSVF grantee directory",
    sharedHousingCompatibility: "Nationally allowable per VA guidance — local verification required",
    referralProcess: "Not Verified — contact current SSVF grantee",
    currentAvailability: "Ongoing — grantee capacity not confirmed",
    unresolvedRestrictions: "Local shared-housing rules; grantee availability",
    sourceKey: "va_ssvf",
    reportingDate: new Date().toISOString().slice(0, 7),
  },
  {
    programName: "GPD (Grant and Per Diem)",
    fitRank: "Future/Constrained",
    localAdminOrg: "Not Verified",
    sharedHousingCompatibility: "Transitional model — not permanent placement",
    referralProcess: "Not Verified",
    currentAvailability: "Not Verified",
    unresolvedRestrictions: "Transitional program; not aligned with FHF permanent model",
    sourceKey: "va_hudvash",
    reportingDate: new Date().toISOString().slice(0, 7),
  },
];

// CoC programs by CoC ID
const COC_PROGRAMS: Record<string, Program[]> = {
  "GA-500": [
    {
      programName: "CoC Rapid Rehousing",
      fitRank: "Possible",
      localAdminOrg: "Partners for HOME (GA-500 CoC lead)",
      sharedHousingCompatibility: "Not Verified",
      referralProcess: "Coordinated Entry System through Partners for HOME",
      currentAvailability: "Not Verified",
      unresolvedRestrictions: "Payment standard; shared-housing rules",
      sourceKey: "hud_coc",
      reportingDate: new Date().toISOString().slice(0, 7),
    },
    {
      programName: "Permanent Supportive Housing Partnership",
      fitRank: "Possible",
      localAdminOrg: "Not Verified — requires service partner identification",
      sharedHousingCompatibility: "Not Verified",
      referralProcess: "Not Verified",
      currentAvailability: "Long development timeline",
      unresolvedRestrictions: "Service partner required; long timeline",
      sourceKey: "hud_coc",
      reportingDate: new Date().toISOString().slice(0, 7),
    },
    {
      programName: "Atlanta Housing HCV (Section 8)",
      fitRank: "Future/Constrained",
      localAdminOrg: "Atlanta Housing",
      sharedHousingCompatibility: "Not Verified",
      referralProcess: "Waitlist — current status not verified",
      currentAvailability: "Waitlist — not actively placing",
      unresolvedRestrictions: "Waitlist; master-lease/sublease rules",
      sourceKey: "hud_coc",
      reportingDate: new Date().toISOString().slice(0, 7),
    },
    {
      programName: "Emergency Housing Vouchers",
      fitRank: "Future/Constrained",
      localAdminOrg: "Atlanta Housing",
      sharedHousingCompatibility: "Not Verified",
      referralProcess: "Not currently accepting new referrals per last available information",
      currentAvailability: "Limited — not active per last available information",
      unresolvedRestrictions: "Allocation exhausted — future availability uncertain",
      sourceKey: "hud_coc",
      reportingDate: new Date().toISOString().slice(0, 7),
    },
  ],
};

// Geo-specific VAMC local admin org
const VAMC_ORG: Record<string, string> = {
  "GA-500": "Atlanta VA Medical Center",
  "CA-600": "VA Greater Los Angeles Healthcare System",
  "NY-600": "VA New York Harbor Healthcare System",
  "TX-700": "Michael E. DeBakey VA Medical Center (Houston)",
  "AZ-502": "Phoenix VA Health Care System",
  "TX-600": "Dallas VA Medical Center",
  "IL-510": "Jesse Brown VA Medical Center (Chicago)",
  "WA-500": "VA Puget Sound Health Care System (Seattle)",
  "CO-503": "Eastern Colorado VA Health Care System (Denver)",
  "NC-505": "W.G. (Bill) Hefner VA Medical Center (Salisbury/Charlotte)",
};

export function collectVaPrograms(geo: GeoContext): CollectorResult<VaProgramData> {
  const now = new Date().toISOString();
  const cocId = geo.cocId;

  // Set local VAMC org on HUD-VASH program
  const programs: Program[] = VA_NATIONAL_PROGRAMS.map((p) => {
    if (p.programName === "HUD-VASH" && cocId && VAMC_ORG[cocId]) {
      return { ...p, localAdminOrg: VAMC_ORG[cocId] };
    }
    return p;
  });

  // Add CoC-specific programs
  if (cocId && COC_PROGRAMS[cocId]) {
    programs.push(...COC_PROGRAMS[cocId]);
  } else {
    programs.push({
      programName: "CoC Rapid Rehousing",
      fitRank: "Possible",
      localAdminOrg: "Not Verified — contact local CoC lead agency",
      sharedHousingCompatibility: "Not Verified",
      referralProcess: "Not Verified — contact local CoC Coordinated Entry",
      currentAvailability: "Not Verified",
      unresolvedRestrictions: "Local program rules not confirmed",
      sourceKey: "hud_coc",
      reportingDate: now.slice(0, 7),
    });
  }

  return {
    data: { programs },
    status: cocId ? "ok" : "partial",
    source: {
      sourceKey: "va_programs",
      sourceAgency: "U.S. Department of Veterans Affairs",
      datasetName: "VA HUD-VASH and SSVF Program Guidance",
      directUrl: "https://www.va.gov/homeless/hud-vash.asp",
      reportingPeriod: now.slice(0, 7),
      geography: cocId ? `${cocId} service area` : geo.city,
      retrievedAt: now,
      retrievalMethod: "static",
      confidence: cocId ? "medium" : "low",
      isDerived: false,
    },
  };
}
