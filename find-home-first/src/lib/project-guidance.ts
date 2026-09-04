import { checkApprovalRequirements } from "@/lib/market-research-validation";
import { getStageLabelForKey } from "@/lib/stages";

export interface GuideProjectSnapshot {
  id: string;
  name: string;
  community: string;
  currentStatus: string;
  currentStage: string;
  targetMoveIn: string | null;
  blocker: string | null;
  blockerReason: string | null;
  nextAction: string | null;
  residentName: string | null;
}

export interface GuideTaskSnapshot {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
}

export interface GuidePropertySnapshot {
  id: string;
  address: string;
  ownerId: string | null;
  listingContact: string | null;
  listingPhone: string | null;
  listingEmail: string | null;
}

export interface GuideResearchSnapshot {
  demandRating: string | null;
  demandEvidenceNotes: string | null;
  fundingSource: string | null;
  expectedPaymentPerResident: string | null;
  expectedOccupancy: string | null;
  expectedPrivateRoomCapacity: string | null;
  maxAcceptableLease: string | null;
  estimatedRentalInventory: string | null;
  supplySourceLinks: string | null;
  transportationAccess: string | null;
  locationNotes: string | null;
  riskInsufficientSupply: boolean;
  riskRentTooHigh: boolean;
  riskRegulatoryIssue: boolean;
  riskWeakReferralPipeline: boolean;
  riskOther: boolean;
  riskMitigationNotes: string | null;
}

export interface GuideNextAction {
  label: string;
  href: string;
  reason: string;
}

export interface GuideProjectContext {
  project: GuideProjectSnapshot | null;
  stageLabel: string | null;
  blocker: { title: string; reason: string | null } | null;
  nextAction: GuideNextAction;
  missingItems: string[];
  openTasks: GuideTaskSnapshot[];
  savedPropertyCount: number;
  summary: string;
}

export interface BuildGuideContextInput {
  project: GuideProjectSnapshot | null;
  research?: GuideResearchSnapshot | null;
  tasks?: GuideTaskSnapshot[];
  properties?: GuidePropertySnapshot[];
}

const CLOSED_TASK_STATUSES = new Set(["done", "completed", "cancelled", "canceled"]);

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function researchMissingItems(research: GuideResearchSnapshot | null | undefined): string[] {
  if (!research) return ["Market Research report"];

  const fields: Record<string, string> = {
    demandRating: research.demandRating ?? "",
    demandEvidenceNotes: research.demandEvidenceNotes ?? "",
    fundingSource: research.fundingSource ?? "",
    expectedPaymentPerResident: research.expectedPaymentPerResident ?? "",
    expectedOccupancy: research.expectedOccupancy ?? "",
    expectedPrivateRoomCapacity: research.expectedPrivateRoomCapacity ?? "",
    maxAcceptableLease: research.maxAcceptableLease ?? "",
    estimatedRentalInventory: research.estimatedRentalInventory ?? "",
    supplySourceLinks: research.supplySourceLinks ?? "",
    transportationAccess: research.transportationAccess ?? "",
    locationNotes: research.locationNotes ?? "",
  };

  const riskChecked =
    research.riskInsufficientSupply ||
    research.riskRentTooHigh ||
    research.riskRegulatoryIssue ||
    research.riskWeakReferralPipeline ||
    research.riskOther;

  return checkApprovalRequirements(
    fields,
    riskChecked,
    research.riskMitigationNotes ?? ""
  ).missing.map((item) => item.label);
}

function deriveStatusAction(project: GuideProjectSnapshot): GuideNextAction {
  const projectHref = `/projects/${project.id}`;

  if (project.blocker) {
    return {
      label: "Resolve project blocker",
      href: projectHref,
      reason: project.blockerReason || project.blocker,
    };
  }

  switch (project.currentStatus) {
    case "researching_city":
      return {
        label: "Complete Market Research",
        href: projectHref,
        reason: "Finish the required market evidence and approve the city before searching for properties.",
      };
    case "city_approved":
    case "finding_property":
      return {
        label: "Find Properties",
        href: `/housing-search?project=${encodeURIComponent(project.id)}`,
        reason: "The market is ready for property sourcing and qualification.",
      };
    case "contacting_owner":
      return {
        label: "Continue Owner Outreach",
        href: `/housing-search?project=${encodeURIComponent(project.id)}`,
        reason: "Move the strongest property candidate forward by confirming the decision-maker and following the outreach playbook.",
      };
    case "application_in_progress":
      return {
        label: "Continue Property Application",
        href: projectHref,
        reason: "Keep the application and property approval work moving until the property is secured.",
      };
    case "property_approved":
    case "preparing_property":
      return {
        label: "Prepare the Property",
        href: projectHref,
        reason: "Finish the remaining property-readiness work before resident placement.",
      };
    case "seeking_referrals":
      return {
        label: "Build the Referral Pipeline",
        href: "/people",
        reason: "The property workflow is far enough along to begin sourcing a qualified resident.",
      };
    case "reviewing_resident":
    case "placement_approved":
      return {
        label: "Continue Resident Placement",
        href: `/projects/${project.id}/placement`,
        reason: "Review the resident match, required documentation, and move-in readiness.",
      };
    case "move_in_scheduled":
      return {
        label: "Complete Move-In",
        href: `/projects/${project.id}/placement`,
        reason: "Confirm the remaining move-in items and record the completed placement.",
      };
    case "moved_in":
      return {
        label: "View Completed Placement",
        href: projectHref,
        reason: "This placement is complete.",
      };
    default:
      return {
        label: project.nextAction?.trim() || "Open Project",
        href: projectHref,
        reason: "Open the project workspace to continue from its current status.",
      };
  }
}

function deriveMissingItems(
  project: GuideProjectSnapshot,
  research: GuideResearchSnapshot | null | undefined,
  properties: GuidePropertySnapshot[]
): string[] {
  const missing: string[] = [];

  if (!nonEmpty(project.community)) missing.push("Target community");

  if (project.currentStatus === "researching_city") {
    missing.push(...researchMissingItems(research));
  }

  if (["city_approved", "finding_property"].includes(project.currentStatus)) {
    if (properties.length === 0) missing.push("Saved property candidate");
  }

  if (project.currentStatus === "contacting_owner") {
    if (properties.length === 0) {
      missing.push("Saved property candidate");
    } else {
      const hasContact = properties.some(
        (property) =>
          nonEmpty(property.ownerId) ||
          nonEmpty(property.listingContact) ||
          nonEmpty(property.listingPhone) ||
          nonEmpty(property.listingEmail)
      );
      if (!hasContact) missing.push("Owner or listing contact information");
    }
  }

  if (
    ["application_in_progress", "property_approved", "preparing_property"].includes(
      project.currentStatus
    ) &&
    properties.length === 0
  ) {
    missing.push("Property linked to this project");
  }

  if (
    ["seeking_referrals", "reviewing_resident", "placement_approved", "move_in_scheduled"].includes(
      project.currentStatus
    ) &&
    !nonEmpty(project.residentName)
  ) {
    missing.push("Resident linked to this placement");
  }

  if (
    ["placement_approved", "move_in_scheduled"].includes(project.currentStatus) &&
    !nonEmpty(project.targetMoveIn)
  ) {
    missing.push("Target move-in date");
  }

  return Array.from(new Set(missing));
}

export function buildGuideProjectContext({
  project,
  research = null,
  tasks = [],
  properties = [],
}: BuildGuideContextInput): GuideProjectContext {
  if (!project) {
    return {
      project: null,
      stageLabel: null,
      blocker: null,
      nextAction: {
        label: "Start New Placement",
        href: "/projects/new",
        reason: "There is no active project yet. Create a placement to begin the guided workflow.",
      },
      missingItems: [],
      openTasks: [],
      savedPropertyCount: 0,
      summary: "There are no active projects. Start a new placement and FHF Guide will begin tracking the workflow with you.",
    };
  }

  const stageLabel = getStageLabelForKey(project.currentStage);
  const missingItems = deriveMissingItems(project, research, properties);
  const openTasks = tasks
    .filter((task) => !CLOSED_TASK_STATUSES.has(task.status.toLowerCase()))
    .slice(0, 5);
  const nextAction = deriveStatusAction(project);
  const blocker = project.blocker
    ? { title: project.blocker, reason: project.blockerReason }
    : null;

  const attentionParts: string[] = [];
  if (blocker) attentionParts.push("a blocker needs attention");
  if (missingItems.length > 0) {
    attentionParts.push(`${missingItems.length} ${missingItems.length === 1 ? "item is" : "items are"} still missing`);
  }
  if (openTasks.length > 0) {
    attentionParts.push(`${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}`);
  }

  const attention = attentionParts.length > 0
    ? ` ${attentionParts.join(", ")}.`
    : " Nothing obvious is blocking the next step.";

  return {
    project,
    stageLabel,
    blocker,
    nextAction,
    missingItems,
    openTasks,
    savedPropertyCount: properties.length,
    summary: `${project.name} is in ${stageLabel} for ${project.community || "its target market"}.${attention}`,
  };
}
