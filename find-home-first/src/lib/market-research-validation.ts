/**
 * Shared market-research approval requirements — single source of truth.
 * Used by: server actions, client component, and tests.
 * Must remain free of Next.js / server-only imports.
 */

// ── Simple required fields (each must be individually non-empty) ──────────────

export interface ValidationField {
  /** FormData / state key */
  key: string;
  /** Human-readable label (shown in UI missing list) */
  label: string;
  /** Exact error message returned by the server action */
  serverError: string;
}

export const REQUIRED_FIELDS: ValidationField[] = [
  { key: "demandRating",               label: "Demand Rating",     serverError: "Demand rating is required before approving." },
  { key: "demandEvidenceNotes",         label: "Demand Evidence",   serverError: "Demand evidence notes are required before approving." },
  { key: "fundingSource",               label: "Funding Source",    serverError: "Funding source is required before approving." },
  { key: "expectedPaymentPerResident",  label: "Payment / Resident",serverError: "Expected payment per resident is required before approving." },
  { key: "expectedOccupancy",           label: "Occupancy Rate",    serverError: "Expected occupancy rate is required before approving." },
  { key: "expectedPrivateRoomCapacity", label: "Room Capacity",     serverError: "Expected private-room capacity is required before approving." },
  { key: "maxAcceptableLease",          label: "Max Lease",         serverError: "Maximum acceptable lease is required before approving." },
];

// ── OR-groups — at least one key in each group must be non-empty ───────────────

export interface OrGroup {
  /** Human-readable label (shown in UI missing list) */
  label: string;
  /** Any one of these keys being non-empty satisfies the requirement */
  keys: string[];
  /** Exact error message returned by the server action */
  serverError: string;
}

export const OR_GROUPS: OrGroup[] = [
  {
    label: "Property Supply Evidence",
    keys: ["estimatedRentalInventory", "supplySourceLinks"],
    serverError: "Property supply evidence (inventory count or source links) is required before approving.",
  },
  {
    label: "Location Suitability",
    keys: ["transportationAccess", "locationNotes"],
    serverError: "Location suitability information is required before approving.",
  },
];

export const RISK_MITIGATION_ERROR =
  "Critical blockers are flagged. Mitigation notes are required before approving.";

// ── Result types ──────────────────────────────────────────────────────────────

export interface MissingField {
  label: string;
  serverError: string;
}

export interface ApprovalCheckResult {
  /** Every unsatisfied requirement (label + server error). */
  missing: MissingField[];
  /** True when at least one risk is checked but mitigation notes are blank. */
  riskBlocker: boolean;
  /** True only when all requirements are satisfied. */
  canApprove: boolean;
}

// ── Main validator ────────────────────────────────────────────────────────────

/**
 * Validate an approval attempt against all shared rules.
 *
 * @param fields          Plain map of field key -> string value
 * @param riskChecked     True when any risk checkbox is checked
 * @param mitigationNotes The riskMitigationNotes field value
 */
export function checkApprovalRequirements(
  fields: Record<string, string>,
  riskChecked: boolean,
  mitigationNotes: string
): ApprovalCheckResult {
  const missing: MissingField[] = [];

  for (const { key, label, serverError } of REQUIRED_FIELDS) {
    if (!fields[key]?.trim()) {
      missing.push({ label, serverError });
    }
  }

  for (const { label, keys, serverError } of OR_GROUPS) {
    const satisfied = keys.some((k) => fields[k]?.trim());
    if (!satisfied) {
      missing.push({ label, serverError });
    }
  }

  const riskBlocker = riskChecked && !mitigationNotes?.trim();
  if (riskBlocker) {
    missing.push({ label: "Mitigation Notes (risks flagged)", serverError: RISK_MITIGATION_ERROR });
  }

  return { missing, riskBlocker, canApprove: missing.length === 0 };
}
