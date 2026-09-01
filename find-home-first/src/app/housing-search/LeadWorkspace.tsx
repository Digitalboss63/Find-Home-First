"use client";

import { useEffect, useState } from "react";
import { LeadWorkspace as BaseLeadWorkspace } from "./LeadWorkspaceBase";
import type {
  LeadWorkspaceProps as BaseLeadWorkspaceProps,
  OwnerContact as BaseOwnerContact,
} from "./LeadWorkspaceBase";
import { getLinkedOwnerForWorkspaceAction } from "./owner-workspace-actions";

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
 * The saved-leads screen historically opened LeadWorkspace without passing
 * initialOwner, so the owner panel always rendered as unlinked even when the
 * database relationship existed. This wrapper resolves the authenticated,
 * project-scoped owner when the workspace opens and also lets the server repair
 * older RentCast leads from the cached owner record.
 */
export function LeadWorkspace(props: BaseLeadWorkspaceProps) {
  const [owner, setOwner] = useState<BaseOwnerContact | null>(
    props.initialOwner ?? null
  );

  useEffect(() => {
    if (props.initialOwner) {
      setOwner(props.initialOwner);
      return;
    }

    let cancelled = false;

    getLinkedOwnerForWorkspaceAction(props.lead.id, props.projectId)
      .then((result) => {
        if (cancelled || !result.ok) return;
        setOwner(result.owner);
      })
      .catch(() => {
        // Non-fatal: the base workspace still renders if owner resolution fails.
      });

    return () => {
      cancelled = true;
    };
  }, [props.lead.id, props.projectId, props.initialOwner]);

  return (
    <BaseLeadWorkspace
      key={`${props.lead.id}:${owner?.id ?? "unlinked"}`}
      {...props}
      initialOwner={owner}
    />
  );
}
