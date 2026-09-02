"use client";

import { useEffect, useMemo, useState } from "react";
import { LeadWorkspace as BaseLeadWorkspace } from "./LeadWorkspaceBase";
import type {
  LeadWorkspaceProps as BaseLeadWorkspaceProps,
  OwnerContact as BaseOwnerContact,
} from "./LeadWorkspaceBase";
import {
  getLinkedOwnerForWorkspaceAction,
  type WorkspaceLeadRefresh,
} from "./owner-workspace-actions";

export type {
  ActivityItem,
  OwnerContact,
  FollowUpTask,
  LeadWorkspaceProps,
  ActiveShowingView,
  ShowingData,
} from "./LeadWorkspaceBase";

/**
 * Thin client wrapper around the existing workspace.
 *
 * Resolves the authenticated, project-scoped owner when the workspace opens.
 * The server also repairs older RentCast owner links, refreshes provider-owned
 * listing metadata from the latest successful search snapshot, and recalculates
 * the persisted owner-enriched opportunity score.
 */
export function LeadWorkspace(props: BaseLeadWorkspaceProps) {
  const [owner, setOwner] = useState<BaseOwnerContact | null>(
    props.initialOwner ?? null
  );
  const [leadRefresh, setLeadRefresh] = useState<WorkspaceLeadRefresh | null>(null);
  const [enrichedScore, setEnrichedScore] = useState<number | null>(null);
  const [enrichedSignals, setEnrichedSignals] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getLinkedOwnerForWorkspaceAction(props.lead.id, props.projectId)
      .then((result) => {
        if (cancelled || !result.ok) return;
        setOwner(result.owner);
        setLeadRefresh(result.leadRefresh ?? null);
        if (result.opportunityScore != null) {
          setEnrichedScore(result.opportunityScore);
        }
        if (result.opportunitySignals != null) {
          setEnrichedSignals(result.opportunitySignals);
        }
      })
      .catch(() => {
        // Non-fatal: the base workspace still renders if enrichment fails.
      });

    return () => {
      cancelled = true;
    };
  }, [props.lead.id, props.projectId]);

  const lead = useMemo(
    () => ({
      ...props.lead,
      ...(leadRefresh ?? {}),
      opportunityScore: enrichedScore ?? props.lead.opportunityScore,
      opportunitySignals: enrichedSignals ?? props.lead.opportunitySignals,
    }),
    [props.lead, leadRefresh, enrichedScore, enrichedSignals]
  );

  return (
    <BaseLeadWorkspace
      key={`${props.lead.id}:${owner?.id ?? "unlinked"}:${lead.opportunityScore ?? "noscore"}`}
      {...props}
      lead={lead}
      initialOwner={owner}
    />
  );
}
