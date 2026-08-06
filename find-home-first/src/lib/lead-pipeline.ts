/**
 * Lead pipeline — authoritative stage definitions and transition rules.
 *
 * These 8 stages are stored in property_leads.acquisition_stage.
 * Server-side transition validation enforces permitted moves only.
 * Terminal stages (agreement_signed, not_interested) require an explicit
 * Reopen action with a recorded reason to leave.
 */

export const PIPELINE_STAGES = [
  { value: "researching", label: "Researching" },
  { value: "ready_for_outreach", label: "Ready for Outreach" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up", label: "Follow-up" },
  { value: "interested", label: "Interested" },
  { value: "negotiating", label: "Negotiating" },
  { value: "agreement_signed", label: "Agreement Signed" },
  { value: "not_interested", label: "Not Interested" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["value"];

export const PIPELINE_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label])
);

/** Permitted forward and lateral transitions. Terminal stages have no permitted moves. */
export const PERMITTED_TRANSITIONS: Record<string, string[]> = {
  researching: ["ready_for_outreach", "not_interested"],
  ready_for_outreach: ["contacted", "researching", "not_interested"],
  contacted: ["follow_up", "interested", "not_interested"],
  follow_up: ["contacted", "interested", "not_interested"],
  interested: ["negotiating", "follow_up", "not_interested"],
  negotiating: ["agreement_signed", "follow_up", "not_interested"],
  agreement_signed: [],
  not_interested: [],
};

export const TERMINAL_STAGES = new Set(["agreement_signed", "not_interested"]);

/**
 * Returns true if the transition from → to is permitted.
 * Reopening a terminal stage requires the explicit reopenLeadAction, not this path.
 */
export function isTransitionPermitted(from: string, to: string): boolean {
  if (from === to) return false; // no-op transitions not permitted
  const allowed = PERMITTED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Maps lead acquisition_stage to project status for automatic project advancement.
 * Only applies at the relevant milestone stages.
 */
export const STAGE_TO_PROJECT_STATUS: Partial<Record<string, string>> = {
  contacted: "contacting_owner",
  negotiating: "application_in_progress",
  agreement_signed: "property_approved",
};
