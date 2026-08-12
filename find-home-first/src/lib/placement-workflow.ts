/**
 * Shared placement-stage rules. This module is intentionally pure so the
 * browser and server actions apply the same validation without database calls.
 */

export const PLACEMENT_WORKSPACE_STATUSES = [
  "preparing_property",
  "seeking_referrals",
  "reviewing_resident",
  "placement_approved",
  "move_in_scheduled",
  "moved_in",
] as const;

export type PlacementWorkspaceStatus =
  (typeof PLACEMENT_WORKSPACE_STATUSES)[number];

export function canUsePlacementWorkspace(status: string): boolean {
  return (PLACEMENT_WORKSPACE_STATUSES as readonly string[]).includes(status);
}

export function residentPropertyFit(input: {
  propertyBedrooms: number | null;
  bedroomsNeeded: number;
}): { compatible: boolean; reason: string } {
  if (input.propertyBedrooms === null) {
    return {
      compatible: true,
      reason: "Property bedroom count is not recorded; confirm capacity manually.",
    };
  }
  if (input.bedroomsNeeded > input.propertyBedrooms) {
    return {
      compatible: false,
      reason: `Resident needs ${input.bedroomsNeeded} bedroom(s), but the property has ${input.propertyBedrooms}.`,
    };
  }
  return {
    compatible: true,
    reason: `Bedroom need (${input.bedroomsNeeded}) fits the recorded property capacity (${input.propertyBedrooms}).`,
  };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function placementStageTitle(status: string): string {
  switch (status) {
    case "preparing_property":
      return "Prepare the Secured Property";
    case "seeking_referrals":
      return "Find a Qualified Resident";
    case "reviewing_resident":
      return "Review the Resident Match";
    case "placement_approved":
      return "Schedule Move-In";
    case "move_in_scheduled":
      return "Confirm Move-In";
    case "moved_in":
      return "Placement Complete";
    default:
      return "Placement Workspace";
  }
}
