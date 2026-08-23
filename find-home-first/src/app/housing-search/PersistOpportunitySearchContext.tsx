"use client";

import { useEffect, useRef } from "react";
import type { PropertySearchDraftView } from "@/lib/repository";
import { saveDraftAction } from "./actions";

/**
 * Persist the corrected Opportunity Engine handoff once it reaches Housing Search.
 *
 * The server page can override stale saved geography for the current render, but
 * without this write the old draft returns when the user leaves and later opens
 * Find Properties from normal navigation. Persisting the corrected draft makes
 * the handoff durable without requiring the user to edit a field or run a search.
 */
export function PersistOpportunitySearchContext({
  draft,
}: {
  draft: PropertySearchDraftView;
}) {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    void saveDraftAction(draft).catch(() => {
      // Non-blocking: the visible search remains usable if persistence fails.
      // A later field edit or successful search will attempt to save again.
    });
  }, [draft]);

  return null;
}
