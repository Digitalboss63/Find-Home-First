/**
 * Stage definitions and status → stage derivation.
 *
 * This is the single source of truth for visible stage labels.
 * Import this from server AND browser code; it contains no DB imports.
 */

export type StageKey =
  | "research"
  | "find-housing"
  | "secure-property"
  | "match-resident"
  | "move-in"
  | "complete"
  | "closed";

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

/** The five stages shown in the placement journey stepper (excludes terminal states). */
export const JOURNEY_STAGES: Stage[] = STAGES;

/**
 * Derives the visible StageKey from a project's current_status value.
 * Terminal statuses ("moved_in", "closed_not_proceeding") are mapped
 * to "complete" and "closed" respectively, which are not shown in the
 * stepper but may be used for display labels.
 */
export function statusToStageKey(
  currentStatus: string
): StageKey {
  switch (currentStatus) {
    case "researching_city":
    case "city_approved":
      return "research";
    case "finding_property":
    case "contacting_owner":
      return "find-housing";
    case "application_in_progress":
    case "property_approved":
    case "preparing_property":
      return "secure-property";
    case "seeking_referrals":
    case "reviewing_resident":
    case "placement_approved":
      return "match-resident";
    case "move_in_scheduled":
      return "move-in";
    case "moved_in":
      return "complete" as StageKey;
    case "closed_not_proceeding":
      return "closed" as StageKey;
    default:
      return "research";
  }
}

export function getStageLabelForKey(key: string): string {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}
